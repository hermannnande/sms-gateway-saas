// Helper: normalize device_token coming from mobile/web clients.
// Some clients may mistakenly send the full QR JSON payload instead of the raw token.
// This keeps backward compatibility by extracting `device_token` when possible.

export function normalizeDeviceToken(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let token = input.trim()
  if (!token) return null

  // If the token looks like a JSON object, try extracting `device_token`
  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token)
      const maybe = (parsed as any)?.device_token
      if (typeof maybe === 'string' && maybe.trim()) {
        token = maybe.trim()
      }
    } catch {
      // ignore JSON parse errors; keep original string
    }
  }

  // Basic sanity: our tokens are hex (generated via randomHex) and typically length 64.
  // But do not hard-reject other lengths to avoid breaking existing installs.
  return token
}


