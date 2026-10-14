import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = await readFile(new URL('../migrations/20261014120000_api_sms_priority.sql', import.meta.url), 'utf8');
const reports = await readFile(new URL('../migrations/20260913000000_atomic_message_status.sql', import.meta.url), 'utf8');
const finalize = await readFile(new URL('../migrations/20260511000001_finalize_campaign_function.sql', import.meta.url), 'utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE service_role; CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TABLE devices (id UUID PRIMARY KEY, org_id UUID, last_seen_at TIMESTAMPTZ, status TEXT);
    CREATE TABLE campaigns (id UUID PRIMARY KEY, org_id UUID, name TEXT DEFAULT 'Test',
      status TEXT DEFAULT 'running', api_key_id UUID, device_id UUID, sim_slot_index INT,
      priority INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ,
      total_count INT DEFAULT 0, sent_count INT DEFAULT 0);
    CREATE TABLE messages (id UUID PRIMARY KEY, org_id UUID, campaign_id UUID,
      device_id UUID, status TEXT DEFAULT 'queued', try_count INT DEFAULT 0,
      last_error TEXT, sent_at TIMESTAMPTZ, to_phone_e164 TEXT DEFAULT '+33612345678',
      body_final TEXT DEFAULT 'Test', sim_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE optouts (org_id UUID, phone_e164 TEXT);
    INSERT INTO devices(id, org_id) VALUES ('${id(2)}','${id(1)}'), ('${id(3)}','${id(1)}'), ('${id(5)}','${id(4)}');
  `);
  await db.exec(finalize);
  await db.exec(reports);
  await db.exec(migration);
  await db.exec(migration);
  const campaign = async (n, { api = false, device = null, priority = 0, status = 'running', org = 1, slot = null } = {}) => {
    await db.query('INSERT INTO campaigns(id,org_id,api_key_id,device_id,priority,status,sim_slot_index) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id(n), id(org), api ? id(99) : null, device ? id(device) : null, priority, status, slot]);
  };
  const message = async (n, c, { status = 'queued', device = null, org = 1, phone = '+33612345678' } = {}) => {
    await db.query('INSERT INTO messages(id,campaign_id,org_id,status,device_id,to_phone_e164) VALUES($1,$2,$3,$4,$5,$6)',
      [id(n),id(c),id(org),status,device ? id(device) : null, phone]);
    await db.query('UPDATE campaigns SET total_count=total_count+1 WHERE id=$1', [id(c)]);
  };
  const claim = async (device = 2, org = 1, limit = 30) => (await db.query(
    'SELECT * FROM claim_messages_atomic($1,$2,$3,$4,$5)', [id(org),id(device),'subscription:7',limit,[]])).rows;
  const check = async (m, device = 2) => (await db.query('SELECT check_sms_dispatch($1,$2) AS decision', [id(device),id(m)])).rows[0].decision;
  const report = async (m, status = 'sent', device = 2) => (await db.query(
    'SELECT report_message_status($1,$2,$3,NULL) AS result', [id(device),id(m),status])).rows[0].result;
  // Exactly the existing Edge Function's recovery of this device's unstarted batch.
  const requeue = () => db.query("UPDATE messages SET status='queued',device_id=NULL,sim_subscription_id=NULL WHERE device_id=$1 AND status='sending' AND sent_at IS NULL", [id(2)]);
  return { db, campaign, message, claim, check, report, requeue };
}

test('API arrival preempts a claimed urgent campaign, retries first, then resumes without duplicates', async () => {
  const h = await setup();
  try {
    await h.campaign(10, { priority: 2, slot: 1 });
    for (const n of [11,12,13]) await h.message(n,10);
    assert.equal((await h.claim()).length,3);
    assert.equal((await h.check(11)).allowed,true);
    assert.equal((await h.report(11)).campaign.sent_count,1);
    await h.campaign(20, { api: true, device: 2, slot: 0 });
    await h.message(21,20); await h.message(22,20);
    assert.deepEqual(await h.check(12),{ allowed:false, reason:'api_priority' });
    assert.equal((await h.db.query('SELECT try_count FROM messages WHERE id=$1',[id(12)])).rows[0].try_count,0);
    await h.requeue();
    const apiBatch = await h.claim();
    assert.deepEqual(apiBatch.map(m=>m.id),[id(21),id(22)]);
    assert.ok(apiBatch.every(m=>m.sim_subscription_id==='slot:0'));
    assert.equal((await h.check(21)).allowed,true);
    assert.equal((await h.claim()).length,0,'in-flight API still blocks campaign');
    await h.report(21);
    assert.equal((await h.report(22,'failed')).status,'queued_retry');
    assert.deepEqual((await h.claim()).map(m=>m.id),[id(22)],'API retry stays ahead');
    await h.report(22);
    const resumed = await h.claim();
    assert.deepEqual(resumed.map(m=>m.id),[id(12),id(13)]);
    assert.ok(resumed.every(m=>m.sim_subscription_id==='slot:1'));
    assert.equal((await h.check(12)).allowed,true,'sending confirmation is enough; no delivery receipt needed');
    await h.report(12); const done = await h.report(13);
    assert.equal(done.campaign.sent_count,3); assert.equal(done.campaign.status,'done');
    assert.equal((await h.claim()).length,0);
  } finally { await h.db.close(); }
});

test('automatic preemption never resumes a manual pause or cancellation; failures eventually release priority', async () => {
  const h = await setup();
  try {
    await h.campaign(10); await h.message(11,10); await h.claim();
    await h.campaign(20,{api:true}); await h.message(21,20);
    assert.equal((await h.check(11)).reason,'api_priority');
    await h.db.query("UPDATE campaigns SET status='paused' WHERE id=$1",[id(10)]);
    await h.requeue(); await h.claim();
    for (let i=0;i<3;i++) { await h.report(21,'failed'); if (i<2) await h.claim(); }
    assert.equal((await h.claim()).length,0,'manual pause remains after API terminal failure');
    assert.equal((await h.db.query('SELECT status FROM campaigns WHERE id=$1',[id(10)])).rows[0].status,'paused');
    await h.db.query("UPDATE campaigns SET status='running' WHERE id=$1",[id(10)]);
    assert.equal((await h.claim())[0].id,id(11));
    await h.db.query("UPDATE campaigns SET status='canceled' WHERE id=$1",[id(10)]);
    assert.equal((await h.check(11)).reason,'message_inactive');
  } finally { await h.db.close(); }
});

test('priority is scoped to eligible device/org, ignores optouts and inactive API work', async () => {
  const h = await setup();
  try {
    await h.campaign(10); await h.message(11,10);
    await h.campaign(20,{api:true,device:3}); await h.message(21,20);
    await h.campaign(30,{api:true,org:4}); await h.message(31,30,{org:4});
    await h.campaign(40,{api:true,status:'paused'}); await h.message(41,40);
    await h.campaign(50,{api:true}); await h.message(51,50,{phone:'+33600000000'});
    await h.db.query('INSERT INTO optouts VALUES($1,$2)',[id(1),'+33600000000']);
    assert.deepEqual((await h.claim()).map(m=>m.id),[id(11)]);
    assert.equal((await h.check(11)).allowed,true);
    assert.equal((await h.check(11,3)).reason,'message_unavailable');
    assert.equal((await h.check(11,5)).reason,'message_unavailable');
    await assert.rejects(h.claim(5,1),/Appareil inaccessible/);
    assert.equal((await h.db.query('SELECT status FROM campaigns WHERE id=$1',[id(50)])).rows[0].status,'done');
    await h.campaign(60,{api:true}); await h.message(61,60,{status:'sending',device:3});
    assert.equal((await h.check(11)).allowed,true,'other phone already sending shared API');
    await h.message(62,60);
    assert.equal((await h.check(11)).reason,'api_priority','shared queued API can use this phone');
    await h.db.query("UPDATE campaigns SET status='canceled' WHERE id=$1",[id(60)]);
    assert.equal((await h.check(11)).allowed,true);
    await h.db.query('INSERT INTO optouts VALUES($1,$2)',[id(1),'+33612345678']);
    assert.equal((await h.check(11)).reason,'optout','new optout checked even after claim');
  } finally { await h.db.close(); }
});

test('API priority beats any manual priority while preserving API priorities and service-only access', async () => {
  const h = await setup();
  try {
    await h.campaign(10,{priority:999}); await h.message(11,10);
    await h.campaign(20,{api:true}); await h.message(21,20);
    await h.campaign(30,{api:true,priority:2}); await h.message(31,30);
    assert.deepEqual((await h.claim()).map(m=>m.id),[id(31),id(21)]);
    for (const sig of ['has_priority_api_messages(uuid,uuid)','check_sms_dispatch(uuid,uuid)','claim_messages_atomic(uuid,uuid,text,integer,text[])']) {
      const rights = (await h.db.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,
        has_function_privilege('authenticated',$1,'EXECUTE') AS client,
        has_function_privilege('service_role',$1,'EXECUTE') AS server`,[sig])).rows[0];
      assert.deepEqual(rights,{anon:false,client:false,server:true});
    }
  } finally { await h.db.close(); }
});
