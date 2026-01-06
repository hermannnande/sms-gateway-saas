import { NextResponse } from 'next/server'

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
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ ok: false, error: 'Authorization Bearer requis' }, { status: 401 })
    }
    const accessToken = auth.slice('Bearer '.length).trim()
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'Token manquant' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    const campaign_id = typeof body?.campaign_id === 'string' ? body.campaign_id.trim() : ''

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'action doit être pause | resume | cancel' }, { status: 400 })
    }
    if (!campaign_id) {
      return NextResponse.json({ ok: false, error: 'campaign_id requis' }, { status: 400 })
    }

    const { url, anonKey } = getSupabaseEnv()
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


