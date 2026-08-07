import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/quota
 * Retourne le plan actif et le quota SMS de l'org.
 * Meme logique que l'Edge Function heartbeat :
 * sms_quota_month = 0 signifie illimite (quota_remaining = null).
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

    const { data: plan, error } = await service.rpc('get_effective_plan', {
      p_org_id: identity.orgId,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: 'query_failed' }, { status: 500 })
    }

    const smsQuota = typeof plan?.sms_quota_month === 'number' ? plan.sms_quota_month : 0

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count } = await service
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', identity.orgId)
      .eq('status', 'sent')
      .gte('sent_at', monthStart)

    const used = count || 0
    const quotaRemaining = smsQuota === 0 ? null : Math.max(smsQuota - used, 0)

    return NextResponse.json({
      ok: true,
      plan: plan
        ? { id: plan.id, name: plan.name, max_devices: plan.max_devices, sms_quota_month: plan.sms_quota_month }
        : null,
      sms_used_this_month: used,
      quota_remaining: quotaRemaining,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
