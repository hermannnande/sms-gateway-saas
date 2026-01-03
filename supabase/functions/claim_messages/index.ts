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

    // Check active subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      throw new Error('Aucun abonnement actif')
    }

    // Check subscription not expired
    const now = new Date()
    const periodEnd = new Date(subscription.current_period_end)
    if (now > periodEnd) {
      // Mark as expired
      await supabaseClient
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', subscription.id)

      throw new Error('Abonnement expiré')
    }

    // Check monthly quota
    const periodStart = new Date(subscription.current_period_start)
    
    const { count: sentCount } = await supabaseClient
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('status', 'sent')
      .gte('sent_at', periodStart.toISOString())

    const smsQuota = subscription.plans.sms_quota_month

    if (sentCount && sentCount >= smsQuota) {
      throw new Error(`Quota mensuel atteint: ${sentCount}/${smsQuota}`)
    }

    // Get optouts for this org
    const { data: optouts } = await supabaseClient
      .from('optouts')
      .select('phone_e164')
      .eq('org_id', org_id)

    const optoutPhones = optouts?.map(o => o.phone_e164) || []

    // Claim messages atomically
    // Use SELECT FOR UPDATE to lock rows
    const { data: messages, error: claimError } = await supabaseClient.rpc(
      'claim_messages_atomic',
      {
        p_org_id: org_id,
        p_device_id: device_id,
        p_sim_subscription_id: sim_subscription_id || null,
        p_limit: limit,
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
        quota_remaining: smsQuota - (sentCount || 0),
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




