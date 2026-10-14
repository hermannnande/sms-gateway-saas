import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/app/api/mobile/delivery-reports/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const device = '00000000-0000-0000-0000-000000000001'
const valid = { message_id: '00000000-0000-0000-0000-000000000002', attempt_id: '00000000-0000-0000-0000-000000000003', status: 'delivered', revision: 2 }
function harness({ known = true, errors = [] } = {}) {
  const calls = []
  const service = {
    from(table) {
      assert.equal(table, 'devices')
      return { select() { return this }, eq(key, value) { assert.equal(key, 'token_hash'); assert.equal(value, 'hashed:device-token'); return this },
        async maybeSingle() { return { data: known ? { id: device } : null, error: null } } }
    },
    async rpc(name, args) { calls.push({ name, args }); return { error: errors.shift() ?? null } },
  }
  const exports = {}
  const modules = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/service': { createServiceClient: () => service },
    '@/lib/device-token': { sha256Hex: token => `hashed:${token}` },
  }
  new Function('require', 'exports', compiled)(name => { assert.ok(modules[name]); return modules[name] }, exports)
  return { calls, send: body => exports.POST(new Request('https://example.test/api/mobile/delivery-reports', { method: 'POST', body: JSON.stringify(body) })) }
}

test('valid receipt authenticates device and returns exact revision', async () => {
  const h = harness()
  const res = await h.send({ device_token: 'device-token', reports: [valid] })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await res.json(), { ok: true, acknowledged: [{ attempt_id: valid.attempt_id, revision: 2 }], rejected: [] })
  assert.deepEqual(h.calls, [{ name: 'report_sms_delivery', args: { p_device_id: device, p_message_id: valid.message_id, p_attempt_id: valid.attempt_id, p_status: 'delivered' } }])
})
test('unknown device cannot write receipts', async () => {
  const h = harness({ known: false })
  assert.equal((await h.send({ device_token: 'device-token', reports: [valid] })).status, 401)
  assert.equal(h.calls.length, 0)
})
test('malformed, unsupported and oversized batches are rejected before writes', async () => {
  for (const reports of [[], Array(51).fill(valid), [{ ...valid, status: 'read' }], [{ ...valid, message_id: 'x' }], [{ ...valid, revision: 0 }], [null]]) {
    const h = harness()
    assert.equal((await h.send({ device_token: 'device-token', reports })).status, 400)
    assert.equal(h.calls.length, 0)
  }
})
test('deleted or inaccessible message is rejected while other receipts continue', async () => {
  const h = harness({ errors: [{ code: '42501' }, null] })
  const second = { ...valid, attempt_id: '00000000-0000-0000-0000-000000000004' }
  const res = await h.send({ device_token: 'device-token', reports: [valid, second] })
  const body = await res.json()
  assert.equal(body.rejected.length, 1)
  assert.equal(body.acknowledged[0].attempt_id, second.attempt_id)
})
test('transient failure after partial success retains the entire batch for idempotent retry', async () => {
  const h = harness({ errors: [null, { code: '57014', message: 'timeout' }] })
  const res = await h.send({ device_token: 'device-token', reports: [valid, { ...valid, revision: 3 }] })
  assert.equal(res.status, 503)
  assert.equal((await res.json()).acknowledged, undefined)
})
