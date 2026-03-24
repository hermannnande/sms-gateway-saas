import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
    const from_phone = typeof body?.from_phone === 'string' ? body.from_phone.trim() : ''
    const message_body = typeof body?.body === 'string' ? body.body.trim() : ''

    if (!device_token || !from_phone || !message_body) {
      return NextResponse.json(
        { ok: false, error: 'device_token, from_phone, body requis' },
        { status: 400 },
      )
    }

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

    // Save to inbox_messages
    await service.from('inbox_messages').insert({
      org_id: orgId,
      device_id: device.id,
      from_phone_e164: from_phone,
      body: message_body,
      received_at: new Date().toISOString(),
    })

    // Check for STOP pattern
    const normalized = message_body.toUpperCase().trim()
    let shouldBlacklist = false
    let reason = ''

    if (normalized === 'STOP') {
      // Direct STOP — works for dedicated devices
      shouldBlacklist = true
      reason = 'Réponse STOP automatique'
    } else if (/^STOP\s+[A-Z0-9]{4,}$/i.test(normalized)) {
      // STOP XXXX — check if the code matches an org short code
      const code = normalized.replace(/^STOP\s+/i, '').trim()
      // Match against the first 4 chars of any org_id (case-insensitive)
      const { data: orgs } = await service
        .from('organizations')
        .select('id')

      const matchedOrg = orgs?.find((o: any) =>
        o.id.toUpperCase().startsWith(code),
      )

      if (matchedOrg && matchedOrg.id === orgId) {
        shouldBlacklist = true
        reason = `Réponse STOP ${code}`
      } else if (matchedOrg) {
        // Blacklist in the matched org instead
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
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur' }, { status: 500 })
  }
}
