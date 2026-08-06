import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/keys
 * Liste les clefs API de l'org de l'utilisateur connecte (session web).
 * Ne retourne JAMAIS les clefs en clair ni les hashes.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifie' }, { status: 401 })
  }

  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!orgMember) {
    return NextResponse.json({ ok: false, error: 'Organisation introuvable' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, revoked_at, created_at')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, keys: data || [] })
}

/**
 * POST /api/keys
 * Cree une nouvelle clef API. La clef complete est retournee UNE SEULE FOIS.
 *
 * Body: { name: string }
 * Reponse: { ok, key: { id, name, key_prefix, api_key } }
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifie' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' && body.name.trim()
    ? body.name.trim().substring(0, 80)
    : 'Clef API'

  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!orgMember) {
    return NextResponse.json({ ok: false, error: 'Organisation introuvable' }, { status: 404 })
  }

  const { key, hash, prefix } = generateApiKey()

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      org_id: orgMember.org_id,
      user_id: user.id,
      name,
      key_prefix: prefix,
      key_hash: hash,
    })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || 'Erreur creation clef' }, { status: 500 })
  }

  // La clef en clair n'est retournee qu'ici, une seule fois
  return NextResponse.json({
    ok: true,
    key: { ...data, api_key: key },
  })
}
