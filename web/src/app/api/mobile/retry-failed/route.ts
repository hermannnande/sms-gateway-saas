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

    const { data: updated, error: upErr } = await sb
      .from('messages')
      .update({ status: 'queued', try_count: 0, last_error: null })
      .eq('org_id', orgId)
      .eq('status', 'failed')
      .select('id')

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    }

    const count = updated?.length ?? 0
    return NextResponse.json({ ok: true, count, message: `${count} message(s) remis en file d'attente` })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur interne' }, { status: 500 })
  }
}
