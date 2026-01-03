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
    if (!['sent', 'failed'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'status doit être sent ou failed' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const token_hash = sha256Hex(device_token)

    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', token_hash)
      .single()
    if (deviceError || !device) {
      return NextResponse.json({ ok: false, error: 'Device non trouvé' }, { status: 400 })
    }

    const { data: message, error: msgError } = await supabase.from('messages').select('*').eq('id', message_id).single()
    if (msgError || !message) {
      return NextResponse.json({ ok: false, error: 'Message non trouvé' }, { status: 400 })
    }
    if (message.org_id !== device.org_id) {
      return NextResponse.json({ ok: false, error: "Message n'appartient pas à cette org" }, { status: 403 })
    }

    if (status === 'sent') {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', message_id)
      if (updateError) {
        return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
      }

      await supabase
        .from('devices')
        .update({ last_seen_at: new Date().toISOString(), status: 'online' })
        .eq('id', device.id)

      if (message.campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('sent_count,total_count,status')
          .eq('id', message.campaign_id)
          .single()

        const newSent = (campaign?.sent_count || 0) + 1
        const updatePayload: Record<string, unknown> = { sent_count: newSent }
        if (campaign?.total_count && campaign.total_count > 0 && newSent >= campaign.total_count) {
          updatePayload.status = 'done'
        }

        await supabase.from('campaigns').update(updatePayload).eq('id', message.campaign_id)
      }

      return NextResponse.json({ ok: true, success: true, status: 'sent' }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // failed
    const newTryCount = (message.try_count || 0) + 1
    const maxRetries = 3

    if (newTryCount < maxRetries) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'queued',
          try_count: newTryCount,
          last_error: errorMsg || 'Unknown error',
          device_id: null,
        })
        .eq('id', message_id)
      if (updateError) {
        return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, success: true, status: 'queued_retry', try_count: newTryCount })
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'failed',
        try_count: newTryCount,
        last_error: errorMsg || 'Max retries reached',
      })
      .eq('id', message_id)
    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, success: true, status: 'failed', try_count: newTryCount })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur' }, { status: 500 })
  }
}


