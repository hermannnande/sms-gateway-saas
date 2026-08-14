import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyApiKey } from '@/lib/api-keys'
import { smartParsePhone } from '@/lib/smart-phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RECIPIENTS = 1000

// ── Anti-spam cote API ──
// L'appareil Android espace deja physiquement les envois (delais aleatoires,
// pauses par lot). Ces limites protegent en plus la FILE D'ATTENTE contre les
// abus cote API (clef compromise, boucle d'envoi mal codee, etc.) :
//   - max RATE_MAX_REQUESTS_PER_MIN requetes d'envoi par minute et par clef
//   - max RATE_MAX_SMS_PER_HOUR destinataires par heure et par clef
const RATE_MAX_REQUESTS_PER_MIN = 10
const RATE_MAX_SMS_PER_HOUR = 1000

/**
 * POST /api/v1/sms
 * Envoie un SMS a un ou plusieurs destinataires.
 *
 * Body JSON:
 *   to        string | string[]  (obligatoire) numero(s) E.164 ou local
 *   message   string             (obligatoire) texte du SMS
 *   messages  string[]           (optionnel) variantes anti-spam (tirage aleatoire)
 *   name      string             (optionnel) nom de la campagne (defaut: "API - <date>")
 *   device_id string             (optionnel) forcer un appareil precis
 *   sim_slot  number             (optionnel) slot SIM (0, 1, ...)
 *   priority  number             (optionnel) 0=normale, 1=haute, 2=urgente
 *
 * Reponse: { ok, campaign_id, total, skipped_optout, invalid }
 * Limites: 429 rate_limited (> 10 req/min) | 429 api_hourly_limit (> 1000 SMS/h)
 */
export async function POST(req: Request) {
  try {
    const identity = await verifyApiKey(req.headers.get('authorization'))
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'Clef API invalide ou revoquee', code: 'invalid_api_key' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Body JSON invalide', code: 'invalid_body' }, { status: 400 })
    }

    const service = createServiceClient()

    // ── Anti-spam API : limite de requetes par minute (par clef) ──
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentRequests } = await service
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', identity.keyId)
      .gte('created_at', oneMinuteAgo)

    if ((recentRequests || 0) >= RATE_MAX_REQUESTS_PER_MIN) {
      return NextResponse.json(
        {
          ok: false,
          error: `Trop de requetes : maximum ${RATE_MAX_REQUESTS_PER_MIN} envois par minute. Patientez avant de reessayer.`,
          code: 'rate_limited',
          limit_per_minute: RATE_MAX_REQUESTS_PER_MIN,
          retry_after_seconds: 60,
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // ── Destinataires ──
    const rawTo: string[] = Array.isArray(body.to) ? body.to : typeof body.to === 'string' ? [body.to] : []
    if (rawTo.length === 0) {
      return NextResponse.json({ ok: false, error: 'Parametre "to" requis (string ou array)', code: 'missing_to' }, { status: 400 })
    }
    if (rawTo.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_RECIPIENTS} destinataires par requete`, code: 'too_many_recipients' },
        { status: 400 }
      )
    }

    // ── Message + variantes ──
    const messageBody = typeof body.message === 'string' ? body.message.trim() : ''
    const rawVariants: string[] = Array.isArray(body.messages) ? body.messages : []
    const variants = [messageBody, ...rawVariants]
      .map((m) => (typeof m === 'string' ? m.trim() : ''))
      .filter((m) => m.length > 0)

    if (variants.length === 0) {
      return NextResponse.json({ ok: false, error: 'Parametre "message" requis', code: 'missing_message' }, { status: 400 })
    }

    // ── Quota (meme logique que l'Edge Function heartbeat) ──
    const { data: plan } = await service.rpc('get_effective_plan', {
      p_org_id: identity.orgId,
    })
    const smsQuota = typeof plan?.sms_quota_month === 'number' ? plan.sms_quota_month : 0
    if (smsQuota > 0) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const { count } = await service
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', identity.orgId)
        .eq('status', 'sent')
        .gte('sent_at', monthStart)
      if ((count || 0) >= smsQuota) {
        return NextResponse.json(
          { ok: false, error: 'Quota SMS epuise. Passez a un plan superieur.', code: 'quota_exceeded' },
          { status: 403 }
        )
      }
    }

    // ── Numeros valides ──
    const parsed = rawTo.map((p) => smartParsePhone(String(p)))
    const uniqueValid = [...new Set(parsed.filter((p): p is string => p !== null))]
    const invalidCount = parsed.filter((p) => p === null).length

    if (uniqueValid.length === 0) {
      return NextResponse.json({ ok: false, error: 'Aucun numero valide', code: 'no_valid_recipient' }, { status: 400 })
    }

    // ── Liste noire (optouts) ──
    const { data: optouts } = await service
      .from('optouts')
      .select('phone_e164')
      .eq('org_id', identity.orgId)

    const optoutSet = new Set((optouts || []).map((o: any) => o.phone_e164))
    const recipients = uniqueValid.filter((p) => !optoutSet.has(p))
    const skippedOptout = uniqueValid.length - recipients.length

    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Tous les destinataires sont dans la liste noire (STOP)', code: 'all_opted_out' },
        { status: 400 }
      )
    }

    // ── Anti-spam API : limite de SMS par heure (par clef) ──
    // Evite de saturer la file d'attente de l'appareil : l'envoi physique
    // est deja espace par l'anti-spam du telephone, on plafonne ici le
    // volume injecte via l'API.
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const { data: hourCampaigns } = await service
      .from('campaigns')
      .select('total_count')
      .eq('api_key_id', identity.keyId)
      .gte('created_at', oneHourAgo)

    const usedThisHour = (hourCampaigns || []).reduce(
      (sum: number, c: any) => sum + (c.total_count || 0),
      0
    )

    if (usedThisHour + recipients.length > RATE_MAX_SMS_PER_HOUR) {
      return NextResponse.json(
        {
          ok: false,
          error: `Limite horaire API atteinte : maximum ${RATE_MAX_SMS_PER_HOUR} SMS par heure via l'API.`,
          code: 'api_hourly_limit',
          limit_per_hour: RATE_MAX_SMS_PER_HOUR,
          used_this_hour: usedThisHour,
          retry_after_seconds: 3600,
        },
        { status: 429, headers: { 'Retry-After': '3600' } }
      )
    }

    // ── Appareil (optionnel) ──
    let deviceId: string | null = null
    if (body.device_id) {
      const { data: dev } = await service
        .from('devices')
        .select('id')
        .eq('id', String(body.device_id))
        .eq('org_id', identity.orgId)
        .maybeSingle()
      if (!dev) {
        return NextResponse.json(
          { ok: false, error: 'Appareil introuvable dans votre organisation', code: 'device_not_found' },
          { status: 404 }
        )
      }
      deviceId = dev.id
    }

    const simSlot = typeof body.sim_slot === 'number' ? body.sim_slot : null
    const priority = typeof body.priority === 'number' ? body.priority : 0
    const campaignName =
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim().substring(0, 120)
        : `API - ${new Date().toISOString().substring(0, 16).replace('T', ' ')}`

    // ── Creation campagne + messages ──
    const { data: campaign, error: campError } = await service
      .from('campaigns')
      .insert({
        org_id: identity.orgId,
        name: campaignName,
        template_id: null,
        device_id: deviceId,
        api_key_id: identity.keyId,
        sim_slot_index: simSlot,
        priority,
        status: 'running',
        created_by: identity.userId,
        total_count: recipients.length,
        sent_count: 0,
      })
      .select('id')
      .single()

    if (campError || !campaign) {
      return NextResponse.json(
        { ok: false, error: `Erreur creation campagne: ${campError?.message}`, code: 'campaign_insert_failed' },
        { status: 500 }
      )
    }

    const messages = recipients.map((phone) => ({
      org_id: identity.orgId,
      campaign_id: campaign.id,
      to_phone_e164: phone,
      body_final: variants[Math.floor(Math.random() * variants.length)],
      status: 'queued',
    }))

    const batchSize = 500
    for (let i = 0; i < messages.length; i += batchSize) {
      const { error: msgError } = await service.from('messages').insert(messages.slice(i, i + batchSize))
      if (msgError) {
        return NextResponse.json(
          { ok: false, error: `Erreur insertion messages: ${msgError.message}`, code: 'message_insert_failed' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      campaign_id: campaign.id,
      total: recipients.length,
      skipped_optout: skippedOptout,
      invalid: invalidCount,
      status: 'queued',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}

/**
 * GET /api/v1/sms
 * Liste les messages envoyes via l'org (pagines).
 *
 * Query params:
 *   page        number (defaut 1)
 *   limit       number (defaut 20, max 100)
 *   status      queued | sending | sent | failed | skipped_optout
 *   campaign_id UUID
 *   phone       filtre sur le numero (contient)
 */
export async function GET(req: Request) {
  try {
    const identity = await verifyApiKey(req.headers.get('authorization'))
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'Clef API invalide ou revoquee', code: 'invalid_api_key' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)))
    const status = url.searchParams.get('status')
    const campaignId = url.searchParams.get('campaign_id')
    const phone = url.searchParams.get('phone')
    const from = (page - 1) * limit

    const service = createServiceClient()
    let query = service
      .from('messages')
      .select('id, campaign_id, to_phone_e164, body_final, status, try_count, last_error, created_at, sent_at', { count: 'exact' })
      .eq('org_id', identity.orgId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (status) query = query.eq('status', status)
    if (campaignId) query = query.eq('campaign_id', campaignId)
    if (phone) query = query.ilike('to_phone_e164', `%${phone}%`)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: 'query_failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      messages: data || [],
      total: count || 0,
      page,
      limit,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Erreur serveur', code: 'server_error' }, { status: 500 })
  }
}
