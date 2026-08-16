import { NextResponse } from 'next/server'
import { sha256Hex } from '@/lib/device-token'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_SETTINGS = {
  message_delay_seconds: 5,
  message_delay_max_seconds: 7,
  batch_pause_enabled: true,
  batch_pause_count: 10,
  batch_pause_min_seconds: 30,
  batch_pause_max_seconds: 45,
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'mobile/runtime-settings', ts: new Date().toISOString() },
    { headers: NO_STORE_HEADERS },
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const deviceToken = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
    const ownerUserId = typeof body?.owner_user_id === 'string' ? body.owner_user_id.trim() : ''

    if (!deviceToken || !ownerUserId) {
      return NextResponse.json(
        { ok: false, error: 'device_token et owner_user_id requis' },
        { status: 400, headers: NO_STORE_HEADERS },
      )
    }

    const service = createServiceClient()
    const { data: device, error: deviceError } = await service
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', sha256Hex(deviceToken))
      .maybeSingle()

    if (deviceError || !device) {
      return NextResponse.json(
        { ok: false, error: 'Appareil non reconnu' },
        { status: 401, headers: NO_STORE_HEADERS },
      )
    }

    // Le user_id local n'est jamais accepté seul : il doit toujours être membre
    // de l'organisation à laquelle le jeton de l'appareil appartient.
    const { data: membership, error: membershipError } = await service
      .from('org_members')
      .select('user_id')
      .eq('org_id', device.org_id)
      .eq('user_id', ownerUserId)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json(
        { ok: false, error: 'Compte non autorisé pour cet appareil' },
        { status: 403, headers: NO_STORE_HEADERS },
      )
    }

    const { data: settings, error: settingsError } = await service
      .from('user_settings')
      .select(
        'message_delay_seconds, message_delay_max_seconds, batch_pause_enabled, batch_pause_count, batch_pause_min_seconds, batch_pause_max_seconds, updated_at',
      )
      .eq('user_id', ownerUserId)
      .maybeSingle()

    if (settingsError) throw settingsError

    return NextResponse.json(
      {
        ok: true,
        settings: settings ?? DEFAULT_SETTINGS,
        fetched_at: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Erreur' },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
