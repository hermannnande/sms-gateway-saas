function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hashBuffer))
}

export function randomHex(bytesLen = 32): string {
  const bytes = new Uint8Array(bytesLen)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

// Alias for sha256Hex (used in Edge Functions)
export async function hashToken(token: string): Promise<string> {
  return sha256Hex(token)
}

