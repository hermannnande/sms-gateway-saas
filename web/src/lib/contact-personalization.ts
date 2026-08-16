import * as XLSX from 'xlsx'

export type ImportedContact = {
  phone: string
  name?: string
}

const PHONE_ALIASES = [
  'phone',
  'telephone',
  'tel',
  'mobile',
  'numero',
  'number',
  'phonee164',
]

const NAME_ALIASES = [
  'name',
  'nomclient',
  'nom',
  'prenom',
  'firstname',
  'contact',
]

export function normalizeContactHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findColumn(headers: readonly unknown[], aliases: readonly string[]): number {
  return headers.findIndex((header) => {
    const normalized = normalizeContactHeader(header)
    return aliases.some((alias) => normalized.includes(alias))
  })
}

/**
 * Convertit les lignes d'un CSV/Excel en contacts en reconnaissant notamment
 * « Téléphone +225 » et « Nom client », même avec accents ou colonnes annexes.
 */
export function parseContactRows(rows: readonly (readonly unknown[])[]): ImportedContact[] {
  const nonEmptyRows = rows.filter((row) =>
    row.some((value) => String(value ?? '').trim() !== ''),
  )
  if (nonEmptyRows.length === 0) return []

  const headers = nonEmptyRows[0]
  let phoneIndex = findColumn(headers, PHONE_ALIASES)
  let nameIndex = findColumn(headers, NAME_ALIASES)
  const hasHeader = phoneIndex !== -1

  if (!hasHeader) {
    phoneIndex = 0
    nameIndex = headers.length > 1 ? 1 : -1
  }

  const contacts: ImportedContact[] = []
  for (const row of nonEmptyRows.slice(hasHeader ? 1 : 0)) {
    const phone = String(row[phoneIndex] ?? '').trim()
    const name = nameIndex === -1 ? '' : String(row[nameIndex] ?? '').trim()
    if (phone) contacts.push({ phone, name: name || undefined })
  }
  return contacts
}

function detectSeparator(firstLine: string): ',' | ';' | '\t' {
  const candidates = [',', ';', '\t'] as const
  let selected: ',' | ';' | '\t' = ','
  let selectedCount = -1

  for (const candidate of candidates) {
    let count = 0
    let quoted = false
    for (let index = 0; index < firstLine.length; index++) {
      const char = firstLine[index]
      if (char === '"') quoted = !quoted
      if (!quoted && char === candidate) count++
    }
    if (count > selectedCount) {
      selected = candidate
      selectedCount = count
    }
  }
  return selected
}

function parseDelimitedRows(content: string): string[][] {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  const separator = detectSeparator(firstLine)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const pushField = () => {
    row.push(field.trim())
    field = ''
  }
  const pushRow = () => {
    pushField()
    if (row.some((value) => value !== '')) rows.push(row)
    row = []
  }

  for (let index = 0; index < content.length; index++) {
    const char = content[index]
    if (char === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"'
        index++
      } else {
        quoted = !quoted
      }
    } else if (!quoted && char === separator) {
      pushField()
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && content[index + 1] === '\n') index++
      pushRow()
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

export function parseDelimitedContacts(content: string): ImportedContact[] {
  return parseContactRows(parseDelimitedRows(content))
}

export function parseExcelContacts(buffer: ArrayBuffer): ImportedContact[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    raw: false,
  })
  return parseContactRows(rows)
}

export function personalizeContactMessage(
  message: string,
  contactName?: string | null,
  fallbackName = 'client',
): string {
  const resolvedName = contactName?.trim() || fallbackName
  return message.replace(/\{(?:nom|name)\}/gi, () => resolvedName)
}

export function hasNameVariable(message: string): boolean {
  return /\{(?:nom|name)\}/i.test(message)
}
