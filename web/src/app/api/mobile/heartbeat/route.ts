import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'mobile/heartbeat', ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
    if (!device_token) {
      return NextResponse.json({ ok: false, error: 'device_token requis' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const token_hash = sha256Hex(device_token)

    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('token_hash', token_hash)
      .single()

    if (deviceError || !device) {
      return NextResponse.json({ ok: false, error: 'Device non trouvé ou token invalide' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('devices')
      .update({ last_seen_at: new Date().toISOString(), status: 'online' })
      .eq('id', device.id)

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur' }, { status: 500 })
  }
}


