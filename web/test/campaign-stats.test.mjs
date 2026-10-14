import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignStats, deliveryLabel } from '../src/lib/campaign-stats.ts'

test('delivery labels do not confuse sending, delivery and absent tracking', () => {
  assert.equal(deliveryLabel('delivered', 'sent'), 'Livré')
  assert.equal(deliveryLabel('pending', 'sent'), 'Accusé en attente')
  assert.equal(deliveryLabel(null, 'sent'), 'Sans suivi')
  assert.equal(deliveryLabel('failed', 'sent'), 'Non livré (confirmé)')
  assert.equal(deliveryLabel('delivered', 'sending'), '—')
})
test('statistics use a server aggregate and never replace an error with zero', async () => {
  const data = [{ campaign_id: 'campaign', sent: 24592, delivered: 19000 }]
  assert.deepEqual(await campaignStats({ async rpc(name, params) {
    assert.equal(name, 'campaign_message_stats')
    assert.deepEqual(params, { p_campaign_ids: ['campaign'] })
    return { data, error: null }
  } }, ['campaign']), data)
  await assert.rejects(campaignStats({ async rpc() { return { error: { message: 'offline' } } } }, ['campaign']), /indisponibles/)
})
