// Phone number utilities (E.164 normalization for Côte d'Ivoire)

export function normalizePhoneCI(phone: string): string | null {
  // Remove spaces, dashes, dots
  let cleaned = phone.replace(/[\s\-\.]/g, '')
  
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  
  // CI country code: 225
  // Mobile format: 225 XX XX XX XX XX (10 digits after 225)
  
  // If starts with 225, keep as is
  if (cleaned.startsWith('225') && cleaned.length === 12) {
    return '+' + cleaned
  }
  
  // If starts with 0, replace with 225
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+225' + cleaned.substring(1)
  }
  
  // If 9 digits (without leading 0), add 225
  if (cleaned.length === 9) {
    return '+225' + cleaned
  }
  
  // Invalid format
  return null
}

export function parseCSV(csvContent: string): Array<{ phone: string; name?: string }> {
  const lines = csvContent.split('\n').filter(line => line.trim())
  
  // Skip header if exists
  const hasHeader = lines[0]?.toLowerCase().includes('phone') || lines[0]?.toLowerCase().includes('number')
  const dataLines = hasHeader ? lines.slice(1) : lines
  
  const contacts: Array<{ phone: string; name?: string }> = []
  
  dataLines.forEach(line => {
    const parts = line.split(',').map(p => p.trim().replace(/['"]/g, ''))
    
    if (parts.length >= 1) {
      const phone = parts[0]
      const name = parts.length >= 2 ? parts[1] : undefined
      
      if (phone) {
        contacts.push({ phone, name })
      }
    }
  })
  
  return contacts
}








