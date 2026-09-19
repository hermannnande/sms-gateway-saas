import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, campaignExportRow } from '../src/lib/campaign-export.ts'

test('preserves quotes, accents, separators and multiline messages', () => {
  assert.equal(csvCell('Bonjour "Léa";\nMerci'), '"Bonjour ""Léa"";\nMerci"')
})
test('neutralizes spreadsheet formulas, including whitespace prefixes', () => {
  for (const value of ['=HYPERLINK("x")', '\t=1+1', '  @SUM(1)', '+2250100000000', '-1+2']) {
    assert.ok(csvCell(value).startsWith('"\''))
  }
})
test('exports sent and failed data without rendering null as text', () => {
  assert.equal(campaignExportRow({ to_phone_e164: '+2250100000000', body_final: 'Bonjour', status: 'sent', sent_at: null }),
    '"\'+2250100000000";"Bonjour";"sent";"";""\r\n')
})
