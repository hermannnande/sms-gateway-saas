import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sha256Hex } from '@/lib/device-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant')
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY manquant')
  return { url, anonKey }
}

async function resolveDevice(service: ReturnType<typeof createServiceClient>, deviceToken: string): Promise<{ id: string; org_id: string } | null> {
  const debugLog: string[] = []

  // Method 1: Edge Function heartbeat (Deno SHA-256)
  try {
    const { url, anonKey } = getSupabaseEnv()
    debugLog.push(`hb_url=${url}/functions/v1/heartbeat`)
    const res = await fetch(`${url}/functions/v1/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ device_token: deviceToken }),
    })
    debugLog.push(`hb_status=${res.status}`)
    const hbText = await res.text()
    debugLog.push(`hb_body=${hbText.substring(0, 200)}`)
    if (res.ok) {
      const hbData = JSON.parse(hbText)
      if (hbData?.device_id) {
        debugLog.push(`hb_device_id=${hbData.device_id}`)
        const { data: dev } = await service
          .from('devices')
          .select('id, org_id')
          .eq('id', hbData.device_id)
          .maybeSingle()
        if (dev) return dev
        debugLog.push('hb_db_lookup_failed')
      }
    }
  } catch (e: any) {
    debugLog.push(`hb_error=${e.message}`)
  }

  // Method 2: Node.js SHA-256
  try {
    const hash = sha256Hex(deviceToken)
    debugLog.push(`node_hash=${hash.substring(0, 16)}`)
    const { data, error } = await service
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', hash)
      .maybeSingle()
    debugLog.push(`node_result=${data ? 'found' : 'null'}${error ? ',err=' + error.message : ''}`)
    if (data) return data
  } catch (e: any) {
    debugLog.push(`node_error=${e.message}`)
  }

  // Store debug log for error response
  ;(resolveDevice as any)._lastDebug = debugLog
  return null
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

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: `Service init failed: ${e.message}` }, { status: 500 })
    }

    const device = await resolveDevice(service, deviceToken)
    if (!device) {
      const hash = sha256Hex(deviceToken)
      return NextResponse.json({
        ok: false,
        error: 'Appareil non reconnu',
        debug: {
          token_length: deviceToken.length,
          hash_prefix: hash.substring(0, 12),
          steps: (resolveDevice as any)._lastDebug || [],
        },
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
        .select('id, name, status, priority, total_count, sent_count, sim_slot_index, device_id, created_at', { count: 'exact' })
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
        .select('id, name, status, priority, total_count, sent_count, sim_slot_index, device_id, created_at')
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
      // Variantes FACULTATIVES : chaque contact reçoit l'une d'elles au hasard.
      const rawVariants: string[] = Array.isArray(body?.messages) ? body.messages : []
      const messageVariants = [messageBody, ...rawVariants]
        .map((m) => (typeof m === 'string' ? m.trim() : ''))
        .filter((m) => m.length > 0)
      const contacts: string[] = body?.contacts || []
      const simSlot = body?.sim_slot_index ?? null
      const priority = typeof body?.priority === 'number' ? body.priority : 0

      if (!name) {
        return NextResponse.json({ ok: false, error: 'Nom de campagne requis' }, { status: 400 })
      }
      if (messageVariants.length === 0) {
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
          device_id: device.id,
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
        // Tirage aléatoire d'une variante par contact (une seule => identique pour tous)
        body_final: messageVariants[Math.floor(Math.random() * messageVariants.length)],
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
