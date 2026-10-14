import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const migration = await readFile(new URL('../migrations/20261014000000_sms_delivery_receipts.sql', import.meta.url), 'utf8')
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

test('delivery receipts: retries, late reports, ownership, exact counts and RLS', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE devices(id UUID PRIMARY KEY, org_id UUID);
      CREATE TABLE campaigns(id UUID PRIMARY KEY, org_id UUID, status TEXT);
      CREATE TABLE messages(id UUID PRIMARY KEY, org_id UUID, campaign_id UUID,
        device_id UUID, status TEXT, sent_at TIMESTAMPTZ);
      INSERT INTO devices VALUES ('${id(1)}','${id(10)}'), ('${id(2)}','${id(10)}'), ('${id(3)}','${id(20)}');
      INSERT INTO campaigns VALUES ('${id(100)}','${id(10)}','done'), ('${id(200)}','${id(20)}','done');
      INSERT INTO messages VALUES ('${id(101)}','${id(10)}','${id(100)}','${id(1)}','sent',now()),
        ('${id(102)}','${id(10)}','${id(100)}','${id(2)}','sent',now()),
        ('${id(201)}','${id(20)}','${id(200)}','${id(3)}','sent',now());
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY; ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
      CREATE POLICY msg_tenant ON messages FOR SELECT TO authenticated USING(org_id=current_setting('test.org')::uuid);
      CREATE POLICY campaign_tenant ON campaigns FOR SELECT TO authenticated USING(org_id=current_setting('test.org')::uuid);
      GRANT SELECT ON messages, campaigns TO authenticated;
    `)
    await db.exec(migration)
    await db.exec(migration)
    const report = async (device, message, attempt, state) => (await db.query(
      'SELECT report_sms_delivery($1,$2,$3,$4) AS r', [id(device), id(message), id(attempt), state])).rows[0].r
    const stats = async (...campaigns) => (await db.query('SELECT * FROM campaign_message_stats($1)', [campaigns.map(id)])).rows
    await assert.rejects(report(3,101,501,'delivered'), /inaccessible/)
    await assert.rejects(report(2,101,501,'delivered'), /autre appareil/)
    await assert.rejects(report(1,101,501,'read'), /invalide/)
    await report(1,101,501,'pending')
    assert.equal((await stats(100))[0].delivery_pending, 1)
    await report(1,101,501,'delivered')
    const date = (await db.query('SELECT delivered_at FROM messages WHERE id=$1', [id(101)])).rows[0].delivered_at
    for (const state of ['delivered','pending','failed']) await report(1,101,501,state)
    assert.equal((await stats(100))[0].delivered, 1)
    assert.deepEqual((await db.query('SELECT delivered_at FROM messages WHERE id=$1', [id(101)])).rows[0].delivered_at, date)
    await assert.rejects(report(2,102,501,'delivered'), /inaccessible/)
    await report(2,102,502,'failed')
    await report(2,102,502,'pending')
    assert.equal((await stats(100))[0].delivery_failed, 1)
    await report(2,102,503,'pending')
    assert.equal((await stats(100))[0].delivery_pending, 1)
    await report(2,102,503,'delivered')
    assert.equal((await stats(100))[0].delivered, 2)
    await report(2,102,502,'failed')
    assert.equal((await stats(100))[0].delivered, 2, 'old attempt never undoes delivery')
    await db.query('UPDATE messages SET device_id=$1 WHERE id=$2', [id(2),id(101)])
    await report(1,101,501,'delivered') // an already-bound attempt survives reassignment
    await assert.rejects(report(1,101,504,'pending'), /autre appareil/)
    // Simulate a receipt arriving before the sent report: never inflate sent or quotas.
    await db.query("UPDATE messages SET status='sending' WHERE id=$1", [id(102)])
    assert.equal((await stats(100))[0].delivered, 1)
    await db.query("UPDATE messages SET status='sent' WHERE id=$1", [id(102)])
    await db.exec(`INSERT INTO messages(id,org_id,campaign_id,device_id,status)
      SELECT md5(n::text)::uuid,'${id(10)}','${id(100)}','${id(1)}','sent' FROM generate_series(1000,2599) n;`)
    const summary = (await stats(100))[0]
    assert.equal(summary.total, 1602)
    assert.equal(summary.sent, 1602)
    assert.equal(summary.delivered, 2)
    assert.equal(summary.delivery_unknown, 1600, 'historical sends never become delivered by assumption')
    assert.equal((await db.query('SELECT status FROM campaigns WHERE id=$1',[id(100)])).rows[0].status, 'done')
    const privileges = (await db.query(`SELECT
      has_function_privilege('authenticated','report_sms_delivery(uuid,uuid,uuid,text)','EXECUTE') AS write,
      has_function_privilege('anon','campaign_message_stats(uuid[])','EXECUTE') AS anon_read`)).rows[0]
    assert.equal(privileges.write, false)
    assert.equal(privileges.anon_read, false)
    await db.exec(`SET test.org='${id(10)}'; SET ROLE authenticated;`)
    const visible = await stats(100,200)
    assert.equal(visible.length, 1)
    assert.equal(visible[0].campaign_id, id(100))
    await assert.rejects(db.query('SELECT * FROM sms_delivery_attempts'), /permission denied/)
    await db.exec('RESET ROLE')
    await db.query('DELETE FROM messages WHERE id=$1', [id(101)])
    await assert.rejects(report(1,101,501,'delivered'), /inaccessible/)
  } finally { await db.close() }
})
