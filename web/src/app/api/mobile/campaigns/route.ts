import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveDevice(service: ReturnType<typeof createServiceClient>, deviceToken: string) {
  // Primary: SHA-256 hash (same as Edge Functions)
  const hash = sha256Hex(deviceToken)
  const { data } = await service
    .from('devices')
    .select('id, org_id')
    .eq('token_hash', hash)
    .maybeSingle()

  if (data) return data

  // Fallback 1: try Web Crypto API hash (in case of subtle differences)
  try {
    const encoded = new TextEncoder().encode(deviceToken)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    const hashArray = new Uint8Array(hashBuffer)
    let webCryptoHash = ''
    for (let i = 0; i < hashArray.length; i++) {
      webCryptoHash += hashArray[i].toString(16).padStart(2, '0')
    }
    if (webCryptoHash !== hash) {
      const { data: d2 } = await service
        .from('devices')
        .select('id, org_id')
        .eq('token_hash', webCryptoHash)
        .maybeSingle()
      if (d2) return d2
    }
  } catch (_) {}

  // Fallback 2: raw token as token_hash (legacy)
  const { data: fallback } = await service
    .from('devices')
    .select('id, org_id')
    .eq('token_hash', deviceToken)
    .maybeSingle()

  return fallback
}

function smartParsePhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-().]/g, '').trim()
  if (!cleaned) return null
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2)
  if (/^\d{11,15}$/.test(cleaned)) cleaned = '+' + cleaned
  if (!cleaned.startsWith('+') && /^\d{8,10}$/.test(cleaned)) cleaned = '+225' + cleaned
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned
  return null
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'mobile/campaigns' })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const deviceToken = (body?.device_token || '').trim()
    const action = (body?.action || 'list').trim()

    if (!deviceToken) {
      return NextResponse.json({ ok: false, error: 'device_token requis' }, { status: 400 })
    }

    const service = createServiceClient()
    const device = await resolveDevice(service, deviceToken)
    if (!device) {
      const hash = sha256Hex(deviceToken)
      const { count } = await service.from('devices').select('*', { count: 'exact', head: true })
      return NextResponse.json({
        ok: false,
        error: 'Appareil non reconnu',
        debug: { token_length: deviceToken.length, hash_prefix: hash.substring(0, 8), devices_total: count },
      }, { status: 403 })
    }

    // ── LIST ──
    if (action === 'list') {
      const page = Math.max(1, body?.page || 1)
      const limit = Math.min(50, Math.max(1, body?.limit || 20))
      const statusFilter = body?.status || null
      const offset = (page - 1) * limit

      let query = service
        .from('campaigns')
        .select('id, name, status, priority, total_count, sent_count, sim_slot_index, created_at', { count: 'exact' })
        .eq('org_id', device.org_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data: campaigns, error, count } = await query

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        campaigns: campaigns || [],
        total: count || 0,
        page,
        limit,
      })
    }

    // ── DETAIL ──
    if (action === 'detail') {
      const campaignId = (body?.campaign_id || '').trim()
      if (!campaignId) {
        return NextResponse.json({ ok: false, error: 'campaign_id requis' }, { status: 400 })
      }

      const { data: campaign, error } = await service
        .from('campaigns')
        .select('id, name, status, priority, total_count, sent_count, sim_slot_index, created_at')
        .eq('id', campaignId)
        .eq('org_id', device.org_id)
        .single()

      if (error || !campaign) {
        return NextResponse.json({ ok: false, error: 'Campagne introuvable' }, { status: 404 })
      }

      const { data: stats } = await service
        .from('messages')
        .select('status')
        .eq('campaign_id', campaignId)

      const statusCounts: Record<string, number> = {}
      for (const m of stats || []) {
        statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
      }

      return NextResponse.json({
        ok: true,
        campaign,
        message_stats: statusCounts,
      })
    }

    // ── CREATE ──
    if (action === 'create') {
      const name = (body?.name || '').trim()
      const messageBody = (body?.message || '').trim()
      const contacts: string[] = body?.contacts || []
      const simSlot = body?.sim_slot_index ?? null
      const priority = typeof body?.priority === 'number' ? body.priority : 0

      if (!name) {
        return NextResponse.json({ ok: false, error: 'Nom de campagne requis' }, { status: 400 })
      }
      if (!messageBody) {
        return NextResponse.json({ ok: false, error: 'Message SMS requis' }, { status: 400 })
      }
      if (!contacts || contacts.length === 0) {
        return NextResponse.json({ ok: false, error: 'Au moins un contact requis' }, { status: 400 })
      }

      const parsedContacts = contacts
        .map((c: string) => smartParsePhone(c))
        .filter((c): c is string => c !== null)

      const uniqueContacts = [...new Set(parsedContacts)]

      if (uniqueContacts.length === 0) {
        return NextResponse.json({ ok: false, error: 'Aucun numero valide' }, { status: 400 })
      }

      // Check quota
      const { data: quotaData } = await service.rpc('get_effective_plan_and_quota', {
        p_org_id: device.org_id,
      })
      if (quotaData && typeof quotaData === 'object') {
        const remaining = (quotaData as any).quota_remaining
        if (typeof remaining === 'number' && remaining <= 0) {
          return NextResponse.json({ ok: false, error: 'Quota SMS epuise' }, { status: 403 })
        }
      }

      // Check optouts
      const { data: optouts } = await service
        .from('optouts')
        .select('phone_e164')
        .eq('org_id', device.org_id)

      const optoutSet = new Set((optouts || []).map((o: any) => o.phone_e164))
      const filteredContacts = uniqueContacts.filter(c => !optoutSet.has(c))

      if (filteredContacts.length === 0) {
        return NextResponse.json({ ok: false, error: 'Tous les contacts sont dans la liste noire' }, { status: 400 })
      }

      // Get org user for created_by
      const { data: orgMember } = await service
        .from('org_members')
        .select('user_id')
        .eq('org_id', device.org_id)
        .limit(1)
        .single()

      const { data: campaign, error: campError } = await service
        .from('campaigns')
        .insert({
          org_id: device.org_id,
          name,
          template_id: null,
          sim_slot_index: simSlot,
          priority,
          status: 'running',
          created_by: orgMember?.user_id || null,
          total_count: filteredContacts.length,
          sent_count: 0,
        })
        .select()
        .single()

      if (campError) {
        return NextResponse.json({ ok: false, error: campError.message }, { status: 500 })
      }

      const messages = filteredContacts.map(phone => ({
        org_id: device.org_id,
        campaign_id: campaign.id,
        to_phone_e164: phone,
        body_final: messageBody,
        status: 'queued',
      }))

      const batchSize = 500
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize)
        const { error: msgError } = await service.from('messages').insert(batch)
        if (msgError) {
          return NextResponse.json({ ok: false, error: `Erreur insertion messages: ${msgError.message}` }, { status: 500 })
        }
      }

      return NextResponse.json({
        ok: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          total_count: filteredContacts.length,
        },
      })
    }

    // ── TEMPLATES ──
    if (action === 'templates') {
      const { data: templates, error } = await service
        .from('templates')
        .select('id, name, body')
        .eq('org_id', device.org_id)
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, templates: templates || [] })
    }

    return NextResponse.json({ ok: false, error: `Action inconnue: ${action}` }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
