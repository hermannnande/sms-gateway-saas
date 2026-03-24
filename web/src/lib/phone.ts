import * as XLSX from 'xlsx'

export function normalizePhoneCI(phone: string): string | null {
  let cleaned = phone.replace(/[\s\-\.()]/g, '')

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }

  // Remove leading 00 (international prefix)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2)
  }

  if (cleaned.startsWith('225') && (cleaned.length === 13 || cleaned.length === 12)) {
    return '+' + cleaned
  }

  if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 11)) {
    return '+225' + cleaned.substring(1)
  }

  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return '+225' + cleaned
  }

  if (cleaned.length === 9) {
    return '+225' + cleaned
  }

  // Accept any number starting with + if already E.164-ish (international)
  if (phone.trim().startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned
  }

  return null
}

export function parseCSV(csvContent: string): Array<{ phone: string; name?: string }> {
  const lines = csvContent.split('\n').filter(line => line.trim())

  const hasHeader = lines[0]?.toLowerCase().includes('phone') ||
    lines[0]?.toLowerCase().includes('number') ||
    lines[0]?.toLowerCase().includes('nom') ||
    lines[0]?.toLowerCase().includes('tel')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const contacts: Array<{ phone: string; name?: string }> = []

  dataLines.forEach(line => {
    // Support CSV (comma) and semicolon and tab separators
    const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ','
    const parts = line.split(sep).map(p => p.trim().replace(/['"]/g, ''))

    if (parts.length >= 1) {
      const phone = parts[0]
      const name = parts.length >= 2 ? parts[1] : undefined
      if (phone) contacts.push({ phone, name })
    }
  })

  return contacts
}

export function parseTXT(txtContent: string): Array<{ phone: string; name?: string }> {
  const lines = txtContent.split('\n').filter(line => line.trim())
  const contacts: Array<{ phone: string; name?: string }> = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Each line is a phone number, optionally followed by separator + name
    const sep = trimmed.includes(';') ? ';' : trimmed.includes('\t') ? '\t' : trimmed.includes(',') ? ',' : null
    if (sep) {
      const parts = trimmed.split(sep).map(p => p.trim().replace(/['"]/g, ''))
      if (parts[0]) contacts.push({ phone: parts[0], name: parts[1] || undefined })
    } else {
      contacts.push({ phone: trimmed })
    }
  }

  return contacts
}

export function parseExcel(buffer: ArrayBuffer): Array<{ phone: string; name?: string }> {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const contacts: Array<{ phone: string; name?: string }> = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    for (const row of rows) {
      const keys = Object.keys(row)
      // Try to find a phone column
      const phoneKey = keys.find(k => {
        const kl = k.toLowerCase()
        return kl.includes('phone') || kl.includes('tel') || kl.includes('number') ||
          kl.includes('num') || kl.includes('mobile') || kl === 'a' || kl === 'b'
      }) || keys[0]

      const nameKey = keys.find(k => {
        const kl = k.toLowerCase()
        return kl.includes('name') || kl.includes('nom') || kl.includes('prenom') || kl.includes('contact')
      }) || (keys.length > 1 ? keys[1] : undefined)

      const phone = String(row[phoneKey] ?? '').trim()
      const name = nameKey ? String(row[nameKey] ?? '').trim() : undefined

      if (phone) contacts.push({ phone, name: name || undefined })
    }

    // Only use first sheet
    break
  }

  return contacts
}








