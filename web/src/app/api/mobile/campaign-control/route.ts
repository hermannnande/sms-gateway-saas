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
  return NextResponse.json(
    { ok: true, service: 'mobile/campaign-control', ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    const campaign_id = typeof body?.campaign_id === 'string' ? body.campaign_id.trim() : ''
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'action doit être pause | resume | cancel' }, { status: 400 })
    }
    if (!campaign_id) {
      return NextResponse.json({ ok: false, error: 'campaign_id requis' }, { status: 400 })
    }

    const { url, anonKey } = getSupabaseEnv()

    // 1) Tentative principale: via JWT user (comme le web)
    const auth = req.headers.get('Authorization') ?? ''
    const headers = { 'Cache-Control': 'no-store' }
    if (auth.toLowerCase().startsWith('bearer ')) {
      const accessToken = auth.slice('Bearer '.length).trim()
      if (accessToken) {
        const upstream = await fetch(`${url}/functions/v1/campaign_control`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action, campaign_id }),
        })

        const text = await upstream.text()
        // Si succès => retour direct
        if (upstream.ok) {
          try {
            const json = text ? JSON.parse(text) : {}
            return NextResponse.json(json, { status: upstream.status, headers })
          } catch (_) {
            return new NextResponse(text, { status: upstream.status, headers })
          }
        }

        // Si échec et on n'a pas de device_token => renvoyer l'erreur upstream
        if (!device_token) {
          try {
            const json = text ? JSON.parse(text) : {}
            return NextResponse.json(json, { status: upstream.status, headers })
          } catch (_) {
            return new NextResponse(text, { status: upstream.status, headers })
          }
        }
        // sinon: on tente le fallback device_token ci-dessous
      }
    }

    // 2) Fallback: via device_token (plus robuste sur mobile, même si session expirée)
    if (!device_token) {
      return NextResponse.json(
        { ok: false, error: 'Authorization Bearer requis (ou device_token requis en fallback)' },
        { status: 401 },
      )
    }

    const service = createServiceClient()
    const tokenHash = sha256Hex(device_token)
    const { data: device, error: devErr } = await service
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (devErr || !device?.org_id) {
      return NextResponse.json({ ok: false, error: 'Device introuvable (token invalide)' }, { status: 401 })
    }

    const org_id = device.org_id as string
    const { data: camp, error: campErr } = await service
      .from('campaigns')
      .select('id, org_id, status')
      .eq('id', campaign_id)
      .maybeSingle()
    if (campErr || !camp || (camp as any).org_id !== org_id) {
      return NextResponse.json({ ok: false, error: 'Campagne introuvable ou non autorisée' }, { status: 403 })
    }

    const now = new Date().toISOString()
    if (action === 'pause') {
      await service.from('campaigns').update({ status: 'paused', paused_at: now }).eq('id', campaign_id)
      await service
        .from('campaign_jobs')
        .update({ status: 'paused', ended_at: null })
        .eq('campaign_id', campaign_id)
        .in('status', ['running', 'queued'])
    } else if (action === 'resume') {
      await service.from('campaigns').update({ status: 'running', paused_at: null, canceled_at: null }).eq('id', campaign_id)
      // best effort: remettre le dernier job en running
      const { data: job } = await service
        .from('campaign_jobs')
        .select('id')
        .eq('campaign_id', campaign_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (job?.id) {
        await service.from('campaign_jobs').update({ status: 'running', started_at: now, ended_at: null }).eq('id', job.id)
      } else {
        await service.from('campaign_jobs').insert({ org_id, campaign_id, status: 'running', started_at: now })
      }
    } else if (action === 'cancel') {
      await service.from('campaigns').update({ status: 'canceled', canceled_at: now }).eq('id', campaign_id)
      await service
        .from('campaign_jobs')
        .update({ status: 'canceled', ended_at: now })
        .eq('campaign_id', campaign_id)
        .in('status', ['running', 'queued', 'paused'])
      await service
        .from('messages')
        .update({ status: 'failed', last_error: 'canceled', device_id: null })
        .eq('campaign_id', campaign_id)
        .in('status', ['queued', 'sending'])
    }

    return NextResponse.json({ success: true, campaign_id, action, via: 'device_token' }, { status: 200, headers })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur' }, { status: 500 })
  }
}


