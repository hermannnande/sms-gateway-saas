/**
 * Parsing intelligent des numeros de telephone internationaux.
 * Accepte : +2250707000000, 002250707000000, 0707000000 (CI par defaut), etc.
 * Retourne un numero au format E.164 ou null si invalide.
 */
export function smartParsePhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-().]/g, '').trim()
  if (!cleaned) return null
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2)
  if (/^\d{11,15}$/.test(cleaned)) cleaned = '+' + cleaned
  if (!cleaned.startsWith('+') && /^\d{8,10}$/.test(cleaned)) cleaned = '+225' + cleaned
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned
  return null
}
