import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const API_KEY_PREFIX = 'sk_live_'

/**
 * Génère une nouvelle clef API.
 * Retourne la clef en clair (a afficher UNE SEULE FOIS a l'utilisateur),
 * son hash SHA-256 (a stocker) et son prefixe visible (identification).
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('hex') // 48 chars hex
  const key = `${API_KEY_PREFIX}${random}`
  return {
    key,
    hash: sha256Hex(key),
    prefix: key.substring(0, 16), // ex: sk_live_a1b2c3d4
  }
}

export interface ApiKeyIdentity {
  keyId: string
  orgId: string
  userId: string
}

/**
 * Verifie une clef API recue via le header Authorization: Bearer sk_live_...
 * Retourne l'identite de l'organisation si la clef est valide, null sinon.
 * Met a jour last_used_at (sans bloquer).
 */
export async function verifyApiKey(authHeader: string | null): Promise<ApiKeyIdentity | null> {
  if (!authHeader) return null

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token || !token.startsWith(API_KEY_PREFIX)) return null

  const hash = sha256Hex(token)
  const service = createServiceClient()

  const { data, error } = await service
    .from('api_keys')
    .select('id, org_id, user_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null

  // Mettre a jour last_used_at sans bloquer la reponse
  service
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { keyId: data.id, orgId: data.org_id, userId: data.user_id }
}
