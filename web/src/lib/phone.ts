import {
  parseDelimitedContacts,
  parseExcelContacts,
} from '@/lib/contact-personalization'

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
  return parseDelimitedContacts(csvContent)
}

export function parseTXT(txtContent: string): Array<{ phone: string; name?: string }> {
  return parseDelimitedContacts(txtContent)
}

export function parseExcel(buffer: ArrayBuffer): Array<{ phone: string; name?: string }> {
  return parseExcelContacts(buffer)
}








