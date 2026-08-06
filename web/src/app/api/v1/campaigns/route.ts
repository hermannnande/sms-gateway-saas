import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/campaigns
 * Liste les campagnes de l'org (pagines).
 *
 * Query params: page, limit (max 50), status
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

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const status = url.searchParams.get('status')
    const from = (page - 1) * limit

    const service = createServiceClient()
    let query = service
      .from('campaigns')
      .select('id, name, status, priority, total_count, sent_count, sim_slot_index, device_id, created_at', { count: 'exact' })
      .eq('org_id', identity.orgId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: 'query_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, campaigns: data || [], total: count || 0, page, limit })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
