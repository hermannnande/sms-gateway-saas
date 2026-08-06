import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/sms/{id}
 * Retourne le statut d'un message precis.
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

    const { data, error } = await service
      .from('messages')
      .select('id, campaign_id, to_phone_e164, body_final, status, try_count, last_error, created_at, sent_at')
      .eq('id', id)
      .eq('org_id', identity.orgId)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'Message introuvable', code: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, message: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
