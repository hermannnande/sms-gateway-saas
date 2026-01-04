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
    { ok: true, service: 'mobile/device-pair', ts: new Date().toISOString() },
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

    const body = await req.json()
    const device_name = typeof body?.device_name === 'string' ? body.device_name.trim() : ''
    if (!device_name) {
      return NextResponse.json({ ok: false, error: 'device_name requis' }, { status: 400 })
    }

    const { url, anonKey } = getSupabaseEnv()
    const upstream = await fetch(`${url}/functions/v1/device_pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ device_name }),
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


