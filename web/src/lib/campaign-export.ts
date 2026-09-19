/** RFC 4180 quoting, with spreadsheet formulas neutralized on download. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function campaignExportRow(row: Record<string, unknown>): string {
  return ['to_phone_e164', 'body_final', 'status', 'sent_at', 'last_error']
    .map((key) => csvCell(row[key])).join(';') + '\r\n'
}
