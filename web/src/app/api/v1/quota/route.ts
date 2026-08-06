import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/quota
 * Retourne le plan actif et le quota SMS de l'org.
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
    const { data, error } = await service.rpc('get_effective_plan_and_quota', {
      p_org_id: identity.orgId,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: 'query_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...(typeof data === 'object' && data !== null ? data : {}) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
