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
