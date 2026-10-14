import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400, headers })
  }
  const token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
  if (!token || token.length > 512 || typeof body?.message_id !== 'string' || !uuid.test(body.message_id)) {
    return NextResponse.json({ error: 'Appareil et message requis' }, { status: 400, headers })
  }
  try {
    const service = createServiceClient()
    const { data: device, error } = await service.from('devices').select('id')
      .eq('token_hash', sha256Hex(token)).maybeSingle()
    if (error) throw error
    if (!device) return NextResponse.json({ error: 'Appareil non reconnu' }, { status: 401, headers })
    const { data, error: checkError } = await service.rpc('check_sms_dispatch', {
      p_device_id: device.id, p_message_id: body.message_id,
    })
    if (checkError || typeof data?.allowed !== 'boolean') throw checkError ?? new Error('Décision manquante')
    return NextResponse.json(data, { headers })
  } catch {
    // Fail closed: the phone keeps its messages and retries before any SMS.
    return NextResponse.json({ error: 'Priorité des envois indisponible' }, { status: 503, headers })
  }
}
