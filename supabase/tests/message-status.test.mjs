// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = await readFile(new URL('../migrations/20260913000000_atomic_message_status.sql', import.meta.url), 'utf8');

test('atomic message reports: retries, drift, tenants and terminal states', async () => {
  const db = new PGlite();
  const org = '00000000-0000-0000-0000-000000000001';
  const phone = '00000000-0000-0000-0000-000000000002';
  const phone2 = '00000000-0000-0000-0000-000000000003';
  const campaign = '00000000-0000-0000-0000-000000000004';
  const sms1 = '00000000-0000-0000-0000-000000000005';
  const sms2 = '00000000-0000-0000-0000-000000000006';
  const sms3 = '00000000-0000-0000-0000-000000000007';
  const stranger = '00000000-0000-0000-0000-000000000008';
  try {
    await db.exec(`
      CREATE ROLE service_role; CREATE ROLE authenticated;
      CREATE TABLE devices (id UUID PRIMARY KEY, org_id UUID, last_seen_at TIMESTAMPTZ, status TEXT);
      CREATE TABLE campaigns (id UUID PRIMARY KEY, org_id UUID, name TEXT, status TEXT,
        sent_count INT, total_count INT, updated_at TIMESTAMPTZ);
      CREATE TABLE messages (id UUID PRIMARY KEY, org_id UUID, campaign_id UUID,
        device_id UUID, status TEXT, try_count INT DEFAULT 0, last_error TEXT, sent_at TIMESTAMPTZ);
      INSERT INTO devices (id,org_id) VALUES ('${phone}','${org}'), ('${phone2}','${org}'), ('${stranger}','${stranger}');
      INSERT INTO campaigns VALUES ('${campaign}','${org}','Test','running',99,3,NOW());
      INSERT INTO messages (id,org_id,campaign_id,device_id,status) VALUES
        ('${sms1}','${org}','${campaign}','${phone}','sending'),
        ('${sms2}','${org}','${campaign}','${phone2}','sending'),
        ('${sms3}','${org}','${campaign}','${phone}','sending');
    `);
    await db.exec(migration);
    await db.exec(migration); // Reapplying the migration is safe.
    const report = async (device, id, status) => (await db.query(
      'SELECT report_message_status($1,$2,$3,NULL) AS result', [device,id,status])).rows[0].result;

    await assert.rejects(report(stranger, sms1, 'sent'), /Message non trouvé/);
    await assert.rejects(report(phone2, sms1, 'sent'), /autre appareil/);
    assert.equal((await report(phone, sms1, 'sent')).campaign.sent_count, 1, 'repairs historical drift');
    const firstSentAt = (await db.query('SELECT sent_at FROM messages WHERE id=$1', [sms1])).rows[0].sent_at;
    for (let i = 0; i < 5; i++) assert.equal((await report(phone, sms1, 'sent')).campaign.sent_count, 1);
    assert.deepEqual((await db.query('SELECT sent_at FROM messages WHERE id=$1', [sms1])).rows[0].sent_at, firstSentAt);
    assert.equal((await report(phone, sms1, 'failed')).status, 'sent', 'late failure cannot undo success');
    assert.equal((await report(phone2, sms2, 'sent')).campaign.sent_count, 2, 'second device contributes once');
    let failed = await report(phone, sms3, 'failed');
    assert.equal(failed.status, 'queued_retry');
    assert.equal(failed.try_count, 1);
    assert.equal((await report(phone, sms3, 'failed')).try_count, 1, 'duplicate failure is not another attempt');
    for (let attempt = 2; attempt <= 3; attempt++) {
      await db.query("UPDATE messages SET status='sending',device_id=$1 WHERE id=$2", [phone,sms3]);
      failed = await report(phone, sms3, 'failed');
      assert.equal(failed.try_count, attempt);
    }
    assert.equal(failed.status, 'failed');
    assert.equal(failed.campaign.status, 'done');
    assert.equal(failed.campaign.sent_count, 2, 'a failed SMS is not sent');
    assert.equal(failed.campaign.total_count, 3);
    await db.query("UPDATE campaigns SET status='canceled' WHERE id=$1", [campaign]);
    assert.equal((await report(phone, sms1, 'sent')).campaign.status, 'canceled');
    const permissions = (await db.query(`SELECT
      has_function_privilege('authenticated','public.report_message_status(uuid,uuid,text,text)','EXECUTE') AS client,
      has_function_privilege('service_role','public.report_message_status(uuid,uuid,text,text)','EXECUTE') AS server`)).rows[0];
    assert.equal(permissions.client, false);
    assert.equal(permissions.server, true);
    await assert.rejects(report(phone,sms1,'bogus'), /status doit/);
  } finally { await db.close(); }
});
