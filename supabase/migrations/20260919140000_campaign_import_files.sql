-- Archivage des fichiers de contacts importés lors de la création d'une campagne.
--
-- Jusqu'ici le fichier choisi par l'utilisateur était lu dans le navigateur
-- (FileReader / SheetJS) puis jeté : seuls les numéros extraits partaient au
-- serveur. Il devenait donc impossible de retrouver le fichier d'un envoi passé.
--
-- On conserve désormais le fichier d'origine dans un bucket privé, avec ses
-- métadonnées en base, pour pouvoir le revoir, le télécharger et le supprimer
-- depuis le tableau de bord.

-- ---------------------------------------------------------------------------
-- 1) Bucket privé
-- ---------------------------------------------------------------------------
-- Aucune limite de type MIME : les navigateurs annoncent un type incohérent
-- pour les CSV (text/csv, application/vnd.ms-excel, ou vide). Le contrôle se
-- fait sur l'extension côté client.
insert into storage.buckets (id, name, public, file_size_limit)
values ('campaign-imports', 'campaign-imports', false, 26214400) -- 25 Mio
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Métadonnées
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_import_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- Le fichier survit à la suppression de sa campagne : il reste listé comme
  -- « campagne supprimée » et l'utilisateur choisit quand s'en séparer.
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_name text,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  contact_count integer not null default 0,
  invalid_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.campaign_import_files is
  'Fichiers de contacts (CSV/TXT/XLS/XLSX) importés lors de la création d''une campagne. Le binaire est dans le bucket campaign-imports.';
comment on column public.campaign_import_files.campaign_name is
  'Nom de la campagne au moment de l''import, conservé même si la campagne est supprimée.';
comment on column public.campaign_import_files.contact_count is
  'Nombre de numéros valides extraits du fichier.';
comment on column public.campaign_import_files.invalid_count is
  'Nombre de lignes ignorées faute de numéro exploitable.';

create index if not exists idx_campaign_import_files_org
  on public.campaign_import_files(org_id, created_at desc);
create index if not exists idx_campaign_import_files_campaign
  on public.campaign_import_files(campaign_id);

alter table public.campaign_import_files enable row level security;

drop policy if exists "Users can view their org import files" on public.campaign_import_files;
drop policy if exists "Users can insert their org import files" on public.campaign_import_files;
drop policy if exists "Users can update their org import files" on public.campaign_import_files;
drop policy if exists "Users can delete their org import files" on public.campaign_import_files;

create policy "Users can view their org import files"
on public.campaign_import_files for select to authenticated
using (org_id in (select public.my_org_ids()));

create policy "Users can insert their org import files"
on public.campaign_import_files for insert to authenticated
with check (org_id in (select public.my_org_ids()));

create policy "Users can update their org import files"
on public.campaign_import_files for update to authenticated
using (org_id in (select public.my_org_ids()))
with check (org_id in (select public.my_org_ids()));

create policy "Users can delete their org import files"
on public.campaign_import_files for delete to authenticated
using (org_id in (select public.my_org_ids()));

-- ---------------------------------------------------------------------------
-- 3) Accès au bucket
-- ---------------------------------------------------------------------------
-- Les objets sont rangés sous « <org_id>/<campaign_id|orphan>/<uuid>-<nom> ».
-- La comparaison se fait en texte : un cast en uuid ferait échouer la policy
-- sur un chemin arbitraire au lieu de simplement le refuser.
create or replace function public.my_org_ids_text()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select org_id::text
  from public.org_members
  where user_id = auth.uid();
$$;

grant execute on function public.my_org_ids_text() to authenticated;

drop policy if exists "Campaign imports are readable by their org" on storage.objects;
drop policy if exists "Campaign imports are writable by their org" on storage.objects;
drop policy if exists "Campaign imports are deletable by their org" on storage.objects;

create policy "Campaign imports are readable by their org"
on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-imports'
  and (storage.foldername(name))[1] in (select public.my_org_ids_text())
);

create policy "Campaign imports are writable by their org"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'campaign-imports'
  and (storage.foldername(name))[1] in (select public.my_org_ids_text())
);

create policy "Campaign imports are deletable by their org"
on storage.objects for delete to authenticated
using (
  bucket_id = 'campaign-imports'
  and (storage.foldername(name))[1] in (select public.my_org_ids_text())
);
