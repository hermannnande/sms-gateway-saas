import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/campaigns/{id}
 * Detail d'une campagne + statistiques des messages par statut.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await verifyApiKey(req.headers.get('authorization'))
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'Clef API invalide ou revoquee', code: 'invalid_api_key' },
        { status: 401 }
      )
    }

    const { id } = await params
    const service = createServiceClient()

    const { data: campaign, error } = await service
      .from('campaigns')
      .select('id, name, status, priority, total_count, sent_count, sim_slot_index, device_id, created_at')
      .eq('id', id)
      .eq('org_id', identity.orgId)
      .maybeSingle()

    if (error || !campaign) {
      return NextResponse.json({ ok: false, error: 'Campagne introuvable', code: 'not_found' }, { status: 404 })
    }

    const { data: stats } = await service
      .from('messages')
      .select('status')
      .eq('campaign_id', id)

    const messageStats: Record<string, number> = {}
    for (const m of stats || []) {
      messageStats[m.status] = (messageStats[m.status] || 0) + 1
    }

    return NextResponse.json({ ok: true, campaign, message_stats: messageStats })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
