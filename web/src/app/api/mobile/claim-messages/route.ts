import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function ensureActiveSubscription(supabase: ReturnType<typeof createServiceClient>, org_id: string) {
  const { data: subRow, error: subError } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('org_id', org_id)
    .eq('status', 'active')
    .single()

  if (!subError && subRow) return subRow

  // Auto-trial
  const trialPlanId = 'trial'
  const { data: existingPlan } = await supabase.from('plans').select('id').eq('id', trialPlanId).maybeSingle()

  if (!existingPlan) {
    await supabase.from('plans').insert({
      id: trialPlanId,
      name: 'Essai (TRIAL)',
      price_xof: 0,
      sms_quota_month: 10000,
      max_devices: 3,
      rate_limit_per_min: 120,
    })
  }

  const nowIso = new Date().toISOString()
  const end = new Date()
  end.setDate(end.getDate() + 14)

  const { data: createdSub, error: createSubErr } = await supabase
    .from('subscriptions')
    .insert({
      org_id,
      plan_id: trialPlanId,
      status: 'active',
      current_period_start: nowIso,
      current_period_end: end.toISOString(),
      provider: 'trial',
    })
    .select('*, plans(*)')
    .single()

  if (createSubErr || !createdSub) throw new Error('Aucun abonnement actif')
  return createdSub
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'mobile/claim-messages', ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const device_token = typeof body?.device_token === 'string' ? body.device_token.trim() : ''
    const limit = typeof body?.limit === 'number' ? body.limit : 20
    const sim_subscription_id = body?.sim_subscription_id ?? null

    if (!device_token) {
      return NextResponse.json({ ok: false, error: 'device_token requis', messages: [], count: 0 }, { status: 400 })
    }

    const supabase = createServiceClient()
    const token_hash = sha256Hex(device_token)

    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, org_id, name')
      .eq('token_hash', token_hash)
      .single()

    if (deviceError || !device) {
      return NextResponse.json({ ok: false, error: 'Device non trouvé ou token invalide', messages: [], count: 0 }, { status: 400 })
    }

    const org_id = device.org_id
    const device_id = device.id

    await supabase.from('devices').update({ last_seen_at: new Date().toISOString(), status: 'online' }).eq('id', device_id)

    const subscription = await ensureActiveSubscription(supabase, org_id)

    const now = new Date()
    const periodEnd = new Date(subscription.current_period_end)
    if (now > periodEnd) {
      await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', subscription.id)
      return NextResponse.json({ ok: false, error: 'Abonnement expiré', messages: [], count: 0 }, { status: 400 })
    }

    const periodStart = new Date(subscription.current_period_start)
    const { count: sentCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('status', 'sent')
      .gte('sent_at', periodStart.toISOString())

    const smsQuota = subscription.plans?.sms_quota_month ?? 0
    if (sentCount && sentCount >= smsQuota) {
      return NextResponse.json({ ok: false, error: `Quota mensuel atteint: ${sentCount}/${smsQuota}`, messages: [], count: 0 }, { status: 400 })
    }

    const { data: optouts } = await supabase.from('optouts').select('phone_e164').eq('org_id', org_id)
    const optoutPhones = (optouts ?? []).map((o: any) => o.phone_e164)

    const { data: messages, error: claimError } = await supabase.rpc('claim_messages_atomic', {
      p_org_id: org_id,
      p_device_id: device_id,
      p_sim_subscription_id: sim_subscription_id,
      p_limit: limit,
      p_optout_phones: optoutPhones,
    })

    if (claimError) {
      return NextResponse.json({ ok: false, error: claimError.message, messages: [], count: 0 }, { status: 500 })
    }

    const claimedMessages = messages ?? []

    return NextResponse.json(
      {
        ok: true,
        success: true,
        messages: claimedMessages,
        count: claimedMessages.length,
        quota_remaining: smsQuota - (sentCount || 0),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erreur', messages: [], count: 0 }, { status: 500 })
  }
}


