// Edge Function: claim_messages
// Claim messages atomiquement pour un device
// CRITIQUE: anti-doublon, vérif subscription, quota

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { hashToken } from '../_shared/crypto.ts'
import { normalizeDeviceToken } from '../_shared/device_token.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Simple GET for connectivity testing (open in browser)
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, service: 'claim_messages', ts: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  }

  try {
    const body = await req.json()
    const device_token = normalizeDeviceToken(body?.device_token)
    const limit = typeof body?.limit === 'number' ? body.limit : 20
    const sim_subscription_id = body?.sim_subscription_id

    if (!device_token) {
      throw new Error('device_token requis')
    }

    // Hash token to find device
    const token_hash = await hashToken(device_token)

    // Create Supabase client with service role (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find device by token_hash
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('*, organizations!inner(id)')
      .eq('token_hash', token_hash)
      .single()

    if (deviceError || !device) {
      throw new Error('Device non trouvé ou token invalide')
    }

    const org_id = device.org_id
    const device_id = device.id

    console.log('Device authenticated:', device_id, 'org:', org_id)

    // Update device last_seen + status
    await supabaseClient
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        status: 'online',
      })
      .eq('id', device_id)

    // Plan effectif (ignore anciens plans masqués). Convention: sms_quota_month = 0 => illimité
    const { data: plan, error: planErr } = await supabaseClient.rpc('get_effective_plan', {
      p_org_id: org_id,
    })
    if (planErr || !plan) {
      throw new Error('Plan introuvable (migrations billing manquantes)')
    }

    const now = new Date()
    const smsQuota = typeof plan?.sms_quota_month === 'number' ? plan.sms_quota_month : 0
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Quota basé sur les SMS réellement envoyés (sent_at) pour permettre de créer une campagne > 100
    const { count: usedCount } = await supabaseClient
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('status', 'sent')
      .gte('sent_at', monthStart)

    const used = usedCount || 0
    const quotaRemaining = smsQuota === 0 ? null : Math.max(smsQuota - used, 0)

    // Si quota atteint (plan gratuit), ne pas bloquer par erreur:
    // on renvoie juste 0 messages à traiter.
    if (smsQuota !== 0 && quotaRemaining !== null && quotaRemaining <= 0) {
      // UX: Mettre les campagnes en pause pour éviter "bloqué / en attente" sans explication côté web.
      // Les messages restent en file (queued) et pourront repartir après upgrade/renouvellement.
      try {
        await supabaseClient
          .from('campaigns')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('org_id', org_id)
          .eq('status', 'running')
      } catch (_) {}

      return new Response(
        JSON.stringify({
          success: true,
          messages: [],
          count: 0,
          plan: { id: plan.id, name: plan.name, max_devices: plan.max_devices, sms_quota_month: plan.sms_quota_month },
          sms_used_this_month: used,
          quota_remaining: 0,
          quota_reached: true,
          reason: 'quota_reached',
          campaign_running: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Get optouts for this org
    const { data: optouts } = await supabaseClient
      .from('optouts')
      .select('phone_e164')
      .eq('org_id', org_id)

    const optoutPhones = optouts?.map(o => o.phone_e164) || []

    // Claim messages atomically
    // Use SELECT FOR UPDATE to lock rows
    const effectiveLimit =
      smsQuota === 0 || quotaRemaining === null ? limit : Math.min(limit, quotaRemaining)

    const { data: messages, error: claimError } = await supabaseClient.rpc(
      'claim_messages_atomic',
      {
        p_org_id: org_id,
        p_device_id: device_id,
        p_sim_subscription_id: sim_subscription_id || null,
        p_limit: effectiveLimit,
        p_optout_phones: optoutPhones,
      }
    )

    if (claimError) {
      console.error('Claim error:', claimError)
      throw new Error('Erreur claim messages: ' + claimError.message)
    }

    const claimedMessages = messages || []

    console.log(`Claimed ${claimedMessages.length} messages for device ${device_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        messages: claimedMessages,
        count: claimedMessages.length,
        plan: { id: plan.id, name: plan.name, max_devices: plan.max_devices, sms_quota_month: plan.sms_quota_month },
        sms_used_this_month: used,
        quota_remaining: quotaRemaining,
        quota_reached: false,
        // infos campagne pour la file d'attente côté mobile (optionnel)
        campaign_running: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, messages: [], count: 0 }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})




