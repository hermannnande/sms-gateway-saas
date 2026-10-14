import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400, headers })
  }
  const token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
  const reports = body?.reports
  if (!token || token.length > 512 || !Array.isArray(reports) || reports.length < 1 || reports.length > 50 ||
      reports.some(r => !r || !uuid.test(r.message_id) || !uuid.test(r.attempt_id) ||
        !['pending', 'delivered', 'failed'].includes(r.status) || !Number.isSafeInteger(r.revision) || r.revision < 1)) {
    return NextResponse.json({ error: 'Accusés invalides (maximum 50)' }, { status: 400, headers })
  }
  try {
    const service = createServiceClient()
    const { data: device, error } = await service.from('devices').select('id').eq('token_hash', sha256Hex(token)).maybeSingle()
    if (error) throw error
    if (!device) return NextResponse.json({ error: 'Appareil non reconnu' }, { status: 401, headers })
    const acknowledged = []
    const rejected = []
    for (const report of reports) {
      const { error: reportError } = await service.rpc('report_sms_delivery', {
        p_device_id: device.id, p_message_id: report.message_id,
        p_attempt_id: report.attempt_id, p_status: report.status,
      })
      // Deleted messages or revoked ownership must not poison the whole queue.
      if (reportError?.code === '42501') rejected.push({ attempt_id: report.attempt_id, revision: report.revision })
      else if (reportError) throw reportError
      else acknowledged.push({ attempt_id: report.attempt_id, revision: report.revision })
    }
    return NextResponse.json({ ok: true, acknowledged, rejected }, { headers })
  } catch {
    // Retry the durable phone queue; partial success is safe to replay.
    return NextResponse.json({ error: 'Synchronisation des accusés indisponible' }, { status: 503, headers })
  }
}
