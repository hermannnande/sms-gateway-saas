import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/keys/{id}
 * Revoque une clef API de facon IMMEDIATE et DEFINITIVE :
 *  1. La clef est marquee revoked_at -> toute requete API renvoie 401
 *     (verification a chaque requete, aucun cache).
 *  2. Toutes les campagnes EN COURS creees via cette clef sont annulees
 *     (meme semantique que campaign_control/cancel : campagne + jobs +
 *     messages queued/sending marques 'failed' avec last_error 'canceled').
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifie' }, { status: 401 })
  }

  const { id } = await params

  // 0) Verifier que la clef appartient bien a l'org de l'utilisateur (RLS)
  const { data: key } = await supabase
    .from('api_keys')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!key) {
    return NextResponse.json({ ok: false, error: 'Clef introuvable' }, { status: 404 })
  }

  // 1) Revoquer la clef (definitif : les requetes API renvoient desormais 401)
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // 2) Annuler toutes les campagnes actives creees via cette clef
  let canceledCampaigns = 0
  try {
    const service = createServiceClient()
    const now = new Date().toISOString()

    const { data: active } = await service
      .from('campaigns')
      .select('id')
      .eq('api_key_id', id)
      .in('status', ['running', 'queued', 'paused'])

    const ids = (active || []).map((c: any) => c.id)
    canceledCampaigns = ids.length

    if (ids.length > 0) {
      await service
        .from('campaigns')
        .update({ status: 'canceled', canceled_at: now })
        .in('id', ids)

      await service
        .from('campaign_jobs')
        .update({ status: 'canceled', ended_at: now })
        .in('campaign_id', ids)
        .in('status', ['running', 'queued', 'paused'])

      // Les messages encore en file d'attente ne seront plus jamais envoyes
      await service
        .from('messages')
        .update({ status: 'failed', last_error: 'canceled', device_id: null })
        .in('campaign_id', ids)
        .in('status', ['queued', 'sending'])
    }
  } catch (_) {
    // Ne pas faire echouer la revocation si la cascade rencontre un souci
  }

  return NextResponse.json({ ok: true, canceled_campaigns: canceledCampaigns })
}
