// Validation de supabase/migrations/20260919140000_campaign_import_files.sql
// contre un PostgreSQL embarqué (PGlite), avec des doublures minimales pour ce
// que Supabase fournit d'office : schémas auth/storage, auth.uid(), my_org_ids().
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')

const MIGRATION =
  process.env.MIGRATION_PATH ??
  new URL('../migrations/20260919140000_campaign_import_files.sql', import.meta.url)

async function freshDb() {
  const db = new PGlite()

  // --- Doublures de l'environnement Supabase -------------------------------
  await db.exec(`
    create schema if not exists auth;
    create schema if not exists storage;
    create role authenticated;

    create table auth.users (id uuid primary key default gen_random_uuid());

    -- auth.uid() renvoie l'utilisateur simulé par la variable de session.
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid;
    $$;

    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );

    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid
    );
    alter table storage.objects enable row level security;

    create or replace function storage.foldername(name text) returns text[]
    language sql immutable as $$
      select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
    $$;

    -- --- Tables du projet effectivement référencées -----------------------
    create table public.organizations (id uuid primary key default gen_random_uuid());
    create table public.campaigns (
      id uuid primary key default gen_random_uuid(),
      org_id uuid references public.organizations(id) on delete cascade,
      name text,
      status text
    );
    create table public.org_members (
      user_id uuid not null,
      org_id uuid not null references public.organizations(id) on delete cascade,
      role text
    );

    create or replace function public.my_org_ids() returns setof uuid
    language sql stable security definer set search_path = public as $$
      select org_id from public.org_members where user_id = auth.uid();
    $$;
  `)

  return db
}

const sql = await readFile(MIGRATION, 'utf8')

test('archives: isolation réelle des lectures et refus des références à une autre organisation', async () => {
  const db = await freshDb()
  await db.exec(sql)
  const integrity = await readFile(new URL('../migrations/20260919180000_import_files_integrity.sql', import.meta.url), 'utf8')
  await db.exec(integrity)
  await db.exec(integrity)
  const orgA = '10000000-0000-0000-0000-000000000001'
  const orgB = '10000000-0000-0000-0000-000000000002'
  const userA = '20000000-0000-0000-0000-000000000001'
  const campA = '30000000-0000-0000-0000-000000000001'
  const campB = '30000000-0000-0000-0000-000000000002'
  await db.exec(`
    insert into organizations(id) values ('${orgA}'), ('${orgB}');
    insert into auth.users(id) values ('${userA}');
    insert into org_members(user_id,org_id) values ('${userA}','${orgA}');
    insert into campaigns(id,org_id) values ('${campA}','${orgA}'), ('${campB}','${orgB}');
    insert into campaign_import_files(org_id,file_name,storage_path) values ('${orgB}','secret.csv','${orgB}/secret.csv');
    insert into storage.objects(bucket_id,name) values ('campaign-imports','${orgB}/secret.csv');
    grant usage on schema public, auth, storage to authenticated;
    grant select, insert, update, delete on all tables in schema public, storage to authenticated;
    select set_config('test.user_id','${userA}',false);
    set role authenticated;
  `)
  const insert = (org, campaign, path) => db.query(`
    insert into campaign_import_files(org_id,campaign_id,uploaded_by,file_name,storage_path,size_bytes)
    values($1,$2,$3,'test.csv',$4,100)`, [org,campaign,userA,path])
  await insert(orgA, campA, `${orgA}/valid.csv`)
  await assert.rejects(insert(orgA, campB, `${orgA}/foreign-campaign.csv`), /row-level security/)
  await assert.rejects(insert(orgA, campA, `${orgB}/forged-path.csv`), /row-level security/)
  await assert.rejects(insert(orgB, campB, `${orgB}/foreign.csv`), /row-level security/)
  const rows = await db.query('select file_name from campaign_import_files')
  assert.deepEqual(rows.rows, [{file_name:'test.csv'}])
  assert.equal((await db.query('select name from storage.objects')).rows.length, 0)
  await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('campaign-imports',$1)`, [`${orgB}/forged.csv`]), /row-level security/)
  await db.close()
})

test('la migration s applique sans erreur', async () => {
  const db = await freshDb()
  await db.exec(sql)
  await db.close()
})

test('la migration est rejouable (idempotente)', async () => {
  const db = await freshDb()
  await db.exec(sql)
  await db.exec(sql) // second passage : aucune erreur attendue
  const { rows } = await db.query(
    `select count(*)::int as n from storage.buckets where id = 'campaign-imports'`,
  )
  assert.equal(rows[0].n, 1, 'le bucket ne doit pas être dupliqué')
  await db.close()
})

test('la table, ses colonnes et ses index existent', async () => {
  const db = await freshDb()
  await db.exec(sql)

  const { rows: cols } = await db.query(`
    select column_name, is_nullable, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'campaign_import_files'
    order by column_name
  `)
  const names = cols.map((c) => c.column_name)
  for (const expected of [
    'id', 'org_id', 'campaign_id', 'campaign_name', 'uploaded_by',
    'file_name', 'storage_path', 'mime_type', 'size_bytes',
    'contact_count', 'invalid_count', 'created_at',
  ]) {
    assert.ok(names.includes(expected), `colonne manquante : ${expected}`)
  }

  const { rows: idx } = await db.query(`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'campaign_import_files'
  `)
  const idxNames = idx.map((i) => i.indexname)
  assert.ok(idxNames.includes('idx_campaign_import_files_org'))
  assert.ok(idxNames.includes('idx_campaign_import_files_campaign'))

  await db.close()
})

test('les 4 policies de la table et les 3 du bucket sont posées', async () => {
  const db = await freshDb()
  await db.exec(sql)

  const { rows: tablePolicies } = await db.query(`
    select cmd from pg_policies
    where schemaname = 'public' and tablename = 'campaign_import_files'
  `)
  assert.equal(tablePolicies.length, 4)
  const cmds = tablePolicies.map((p) => p.cmd).sort()
  assert.deepEqual(cmds, ['DELETE', 'INSERT', 'SELECT', 'UPDATE'])

  const { rows: storagePolicies } = await db.query(`
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'Campaign imports%'
  `)
  assert.equal(storagePolicies.length, 3)

  const { rows: rls } = await db.query(`
    select relrowsecurity from pg_class
    where relname = 'campaign_import_files' and relnamespace = 'public'::regnamespace
  `)
  assert.equal(rls[0].relrowsecurity, true, 'RLS doit être activée')

  await db.close()
})

test('my_org_ids_text renvoie bien les orgs de l utilisateur courant', async () => {
  const db = await freshDb()
  await db.exec(sql)

  const { rows: orgs } = await db.query(
    `insert into public.organizations default values returning id`,
  )
  const orgId = orgs[0].id
  const { rows: users } = await db.query(
    `insert into auth.users default values returning id`,
  )
  const userId = users[0].id
  const { rows: others } = await db.query(
    `insert into auth.users default values returning id`,
  )

  await db.query(`insert into public.org_members (user_id, org_id) values ($1, $2)`, [
    userId,
    orgId,
  ])

  await db.query(`select set_config('test.user_id', $1, false)`, [userId])
  const mine = await db.query(`select public.my_org_ids_text() as v`)
  assert.deepEqual(mine.rows.map((r) => r.v), [orgId])

  await db.query(`select set_config('test.user_id', $1, false)`, [others[0].id])
  const theirs = await db.query(`select public.my_org_ids_text() as v`)
  assert.equal(theirs.rows.length, 0, 'un autre utilisateur ne voit aucune org')

  await db.close()
})

test('le chemin des objets est comparé sans cast, meme sur un chemin arbitraire', async () => {
  const db = await freshDb()
  await db.exec(sql)

  const { rows: orgs } = await db.query(
    `insert into public.organizations default values returning id`,
  )
  const orgId = orgs[0].id

  // La policy compare (storage.foldername(name))[1] à du texte : un chemin qui
  // n'est pas un uuid doit simplement ne pas correspondre, sans lever d'erreur.
  const { rows } = await db.query(
    `select (storage.foldername($1))[1] = $2 as ok,
            (storage.foldername($3))[1] = $2 as arbitraire`,
    [`${orgId}/camp/fichier.csv`, orgId, 'pas-un-uuid/x/f.csv'],
  )
  assert.equal(rows[0].ok, true)
  assert.equal(rows[0].arbitraire, false)

  await db.close()
})

test('supprimer la campagne conserve le fichier, supprimer l org le retire', async () => {
  const db = await freshDb()
  await db.exec(sql)

  const { rows: orgs } = await db.query(
    `insert into public.organizations default values returning id`,
  )
  const orgId = orgs[0].id
  const { rows: camps } = await db.query(
    `insert into public.campaigns (org_id, name, status) values ($1, 'Test', 'running') returning id`,
    [orgId],
  )
  const campaignId = camps[0].id

  await db.query(
    `insert into public.campaign_import_files
       (org_id, campaign_id, campaign_name, file_name, storage_path, size_bytes, contact_count)
     values ($1, $2, 'Test', 'contacts.csv', $3, 1024, 42)`,
    [orgId, campaignId, `${orgId}/${campaignId}/abc-contacts.csv`],
  )

  await db.query(`delete from public.campaigns where id = $1`, [campaignId])
  const afterCampaign = await db.query(
    `select campaign_id, campaign_name from public.campaign_import_files`,
  )
  assert.equal(afterCampaign.rows.length, 1, 'le fichier survit à la campagne')
  assert.equal(afterCampaign.rows[0].campaign_id, null)
  assert.equal(
    afterCampaign.rows[0].campaign_name,
    'Test',
    'le nom de campagne reste lisible',
  )

  await db.query(`delete from public.organizations where id = $1`, [orgId])
  const afterOrg = await db.query(`select 1 from public.campaign_import_files`)
  assert.equal(afterOrg.rows.length, 0, 'le fichier suit la suppression de l org')

  await db.close()
})

test('storage_path est unique', async () => {
  const db = await freshDb()
  await db.exec(sql)

  const { rows: orgs } = await db.query(
    `insert into public.organizations default values returning id`,
  )
  const orgId = orgs[0].id
  const path = `${orgId}/x/doublon.csv`

  await db.query(
    `insert into public.campaign_import_files (org_id, file_name, storage_path)
     values ($1, 'a.csv', $2)`,
    [orgId, path],
  )

  await assert.rejects(
    db.query(
      `insert into public.campaign_import_files (org_id, file_name, storage_path)
       values ($1, 'b.csv', $2)`,
      [orgId, path],
    ),
    /unique|duplicate/i,
  )

  await db.close()
})
