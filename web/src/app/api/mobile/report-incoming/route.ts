import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  // Numéros locaux CI (10 chiffres commençant par 0) → +225
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+225${digits.slice(1)}`
  }
  return `+${digits}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
    const from_phone_raw = typeof body?.from_phone === 'string' ? body.from_phone.trim() : ''
    const message_body = typeof body?.body === 'string' ? body.body.trim() : ''

    if (!device_token || !from_phone_raw || !message_body) {
      return NextResponse.json(
        { ok: false, error: 'device_token, from_phone, body requis' },
        { status: 400 },
      )
    }

    const from_phone = normalizePhoneE164(from_phone_raw)

    const service = createServiceClient()
    const tokenHash = sha256Hex(device_token)

    const { data: device } = await service
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!device) {
      return NextResponse.json({ ok: false, error: 'Device introuvable' }, { status: 404 })
    }

    const orgId = device.org_id

    const { error: insertError } = await service.from('inbox_messages').insert({
      org_id: orgId,
      device_id: device.id,
      from_phone_e164: from_phone,
      body: message_body,
      received_at: new Date().toISOString(),
    })

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
    }

    // Check for STOP pattern
    const normalized = message_body.toUpperCase().trim()
    let shouldBlacklist = false
    let reason = ''

    if (normalized === 'STOP') {
      shouldBlacklist = true
      reason = 'Réponse STOP automatique'
    } else if (/^STOP\s+[A-Z0-9]{4,}$/i.test(normalized)) {
      const code = normalized.replace(/^STOP\s+/i, '').trim()
      const { data: orgs } = await service
        .from('organizations')
        .select('id')

      const matchedOrg = orgs?.find((o: { id: string }) =>
        o.id.toUpperCase().startsWith(code),
      )

      if (matchedOrg && matchedOrg.id === orgId) {
        shouldBlacklist = true
        reason = `Réponse STOP ${code}`
      } else if (matchedOrg) {
        await service.from('optouts').upsert(
          { org_id: matchedOrg.id, phone_e164: from_phone, reason: `Réponse STOP ${code}` },
          { onConflict: 'org_id,phone_e164' },
        )
        return NextResponse.json({
          ok: true,
          blacklisted: true,
          org_id: matchedOrg.id,
          message: `Numéro ajouté à la liste noire de l'organisation ${code}`,
        })
      }
    }

    if (shouldBlacklist) {
      await service.from('optouts').upsert(
        { org_id: orgId, phone_e164: from_phone, reason },
        { onConflict: 'org_id,phone_e164' },
      )
    }

    return NextResponse.json({
      ok: true,
      blacklisted: shouldBlacklist,
      message: shouldBlacklist
        ? 'Numéro ajouté à la liste noire'
        : 'Message reçu enregistré',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erreur'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
