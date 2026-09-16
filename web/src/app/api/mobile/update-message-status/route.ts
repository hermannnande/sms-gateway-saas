import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant')
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY manquant')
  return { url, anonKey }
}

export async function GET() {
  // Health check (proxy side)
  return NextResponse.json(
    { ok: true, service: 'mobile/update-message-status', ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
    const message_id = body?.message_id
    const status = body?.status
    const errorMsg = body?.error ?? null

    if (!device_token || !message_id || !status) {
      return NextResponse.json({ ok: false, error: 'device_token, message_id, status requis' }, { status: 400 })
    }

    // Tracking : démarré sans await pour s'exécuter en parallèle de l'appel amont.
    // Sa latence se cache ainsi dans celle du fetch au lieu de s'y ajouter, ce qui
    // libère le budget de cadence du mode turbo sur le chemin critique de chaque SMS.
    // Les erreurs sont avalées : le tracking ne doit jamais faire échouer la requête.
    const trackingPromise = (async () => {
      const service = createServiceClient()
      const tokenHash = sha256Hex(device_token)
      const { data: device } = await service
        .from('devices')
        .select('id, org_id')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      await service.from('analytics_events').insert({
        event_type: 'device_update_status',
        platform: 'mobile',
        org_id: device?.org_id ?? null,
        device_id: device?.id ?? null,
        meta: { token_hash: tokenHash, message_id, status },
      })
    })().catch(() => {})

    const { url, anonKey } = getSupabaseEnv()
    const upstream = await fetch(`${url}/functions/v1/update_message_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ device_token, message_id, status, error: errorMsg }),
    })

    const text = await upstream.text()

    // On attend le tracking avant de répondre : sur Vercel une promesse flottante
    // peut être tuée dès le retour de la réponse, ce qui perdrait silencieusement
    // la ligne analytics. À ce stade elle est déjà terminée dans la quasi-totalité
    // des cas, donc l'attente est gratuite.
    await trackingPromise

    const headers = { 'Cache-Control': 'no-store' }
    try {
      const json = text ? JSON.parse(text) : {}
      return NextResponse.json(json, { status: upstream.status, headers })
    } catch (_) {
      return new NextResponse(text, { status: upstream.status, headers })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur' }, { status: 500 })
  }
}
