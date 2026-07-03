import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''

    if (!device_token) {
      return NextResponse.json({ ok: false, error: 'device_token requis' }, { status: 400 })
    }

    const sb = createServiceClient()
    const tokenHash = sha256Hex(device_token)

    const { data: device, error: devErr } = await sb
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (devErr || !device) {
      return NextResponse.json({ ok: false, error: 'Appareil introuvable' }, { status: 404 })
    }

    const orgId = device.org_id
    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'Aucune organisation' }, { status: 400 })
    }

    // Ne requeue que les messages dont la campagne peut réellement renvoyer:
    // - running / paused: le claim les reprendra (après reprise si paused)
    // - done: on rouvre la campagne en 'running' pour que le retry parte
    // - canceled / sans campagne: ignorés (le claim ne les prendrait jamais,
    //   l'utilisateur verrait "N remis en file" sans aucun envoi réel)
    const { data: failedRows, error: listErr } = await sb
      .from('messages')
      .select('id, campaign_id, campaigns!inner(id, status)')
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .in('campaigns.status', ['running', 'paused', 'done'])

    if (listErr) {
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 })
    }

    const ids = (failedRows ?? []).map((r: any) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, count: 0, message: 'Aucun message à réessayer' })
    }

    const { data: updated, error: upErr } = await sb
      .from('messages')
      .update({ status: 'queued', try_count: 0, last_error: null, device_id: null })
      .in('id', ids)
      .select('id')

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    }

    // Rouvrir les campagnes 'done' concernées pour que les retries partent.
    const doneCampaignIds = [...new Set(
      (failedRows ?? [])
        .filter((r: any) => r.campaigns?.status === 'done')
        .map((r: any) => r.campaign_id)
        .filter(Boolean),
    )]
    if (doneCampaignIds.length > 0) {
      await sb
        .from('campaigns')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .in('id', doneCampaignIds)
        .eq('status', 'done')
    }

    const count = updated?.length ?? 0
    return NextResponse.json({ ok: true, count, message: `${count} message(s) remis en file d'attente` })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur interne' }, { status: 500 })
  }
}
