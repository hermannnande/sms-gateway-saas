import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/app/api/mobile/dispatch-check/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const device = '00000000-0000-0000-0000-000000000001'
const message = '00000000-0000-0000-0000-000000000002'
function harness({ known = true, result = { allowed: true, reason: 'ready', is_api: false }, error = null } = {}) {
  const calls = []
  const service = {
    from(table) {
      assert.equal(table,'devices')
      return { select() { return this }, eq(k,v) { assert.equal(k,'token_hash'); assert.equal(v,'hashed:device-token'); return this },
        async maybeSingle() { return { data: known ? { id: device } : null, error: null } } }
    },
    async rpc(name,args) { calls.push({name,args}); return {data:result,error} },
  }
  const exports = {}
  const modules = {
    'next/server': { NextResponse: { json:(body,init)=>Response.json(body,init) } },
    '@/lib/supabase/service': { createServiceClient:()=>service },
    '@/lib/device-token': { sha256Hex:token=>`hashed:${token}` },
  }
  new Function('require','exports',compiled)(name=>{assert.ok(modules[name]);return modules[name]},exports)
  return { calls, send:(body={device_token:'device-token',message_id:message})=>exports.POST(new Request('https://example.test/api/mobile/dispatch-check',{method:'POST',body:JSON.stringify(body)})) }
}
test('authenticated dispatch checks the actual device, never a caller-supplied device/org', async()=>{
  const h=harness(); const res=await h.send({device_token:'device-token',message_id:message,device_id:'stranger',org_id:'stranger'})
  assert.equal(res.status,200); assert.equal(res.headers.get('cache-control'),'no-store'); assert.equal((await res.json()).allowed,true)
  assert.deepEqual(h.calls,[{name:'check_sms_dispatch',args:{p_device_id:device,p_message_id:message}}])
})
test('API deferral and manual inactivity pass back without approving an SMS',async()=>{
  for(const reason of ['api_priority','message_inactive','message_unavailable','optout']) {
    const h=harness({result:{allowed:false,reason}}); const res=await h.send()
    assert.equal(res.status,200); assert.deepEqual(await res.json(),{allowed:false,reason})
  }
})
test('invalid credentials and request data cannot reach dispatch RPC',async()=>{
  const unknown=harness({known:false}); assert.equal((await unknown.send()).status,401); assert.equal(unknown.calls.length,0)
  for(const body of [{},{device_token:'device-token',message_id:'bad'},null]) {
    const h=harness(); assert.equal((await h.send(body)).status,400); assert.equal(h.calls.length,0)
  }
})
test('database/protocol failure never falls back to allowing the send',async()=>{
  for(const options of [{error:{code:'57014'}},{result:null},{result:{allowed:'true'}}]) {
    const res=await harness(options).send(); assert.equal(res.status,503); assert.equal((await res.json()).allowed,undefined)
  }
})
