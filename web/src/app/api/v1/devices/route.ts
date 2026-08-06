import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/devices
 * Liste les appareils connectes de l'org avec leur statut en ligne.
 */
export async function GET(req: Request) {
  try {
    const identity = await verifyApiKey(req.headers.get('authorization'))
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'Clef API invalide ou revoquee', code: 'invalid_api_key' },
        { status: 401 }
      )
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('devices')
      .select('id, name, status, last_seen_at, created_at')
      .eq('org_id', identity.orgId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: 'query_failed' }, { status: 500 })
    }

    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const devices = (data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      online: d.last_seen_at ? new Date(d.last_seen_at).getTime() > fiveMinAgo : false,
      last_seen_at: d.last_seen_at,
      created_at: d.created_at,
    }))

    return NextResponse.json({ ok: true, devices })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
