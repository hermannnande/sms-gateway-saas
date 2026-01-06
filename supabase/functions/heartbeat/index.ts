// Edge Function: heartbeat
// Keep device status "online" with regular pings from mobile app

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
      JSON.stringify({ ok: true, service: 'heartbeat', ts: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  }

  try {
    const body = await req.json()
    const device_token = normalizeDeviceToken(body?.device_token)
    const app_version = body?.app_version || null
    const user_agent = req.headers.get('User-Agent') || null

    if (!device_token) {
      throw new Error('device_token requis')
    }

    // Hash token to find device
    const token_hash = await hashToken(device_token)

    console.log(`Checking heartbeat for token hash: ${token_hash.slice(0, 8)}...`)

    // Extract IP address (check multiple headers for proxy/cloudflare scenarios)
    const ip_address = 
      req.headers.get('CF-Connecting-IP') ||
      req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.headers.get('X-Real-IP') ||
      null

    // Geolocation via IP (free service, no auth required)
    let country = null
    let city = null
    if (ip_address) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip_address}/json/`, {
          headers: { 'User-Agent': 'SMS-Gateway-Heartbeat' },
          signal: AbortSignal.timeout(3000), // 3s timeout
        })
        if (geoRes.ok) {
          const geoData = await geoRes.json()
          country = geoData.country_name || null
          city = geoData.city || null
        }
      } catch (geoErr) {
        console.warn('Geolocation failed (non-blocking):', geoErr)
        // Non-bloquant, on continue sans geo
      }
    }

    // Create Supabase client with service role (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find device by token_hash
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('id, org_id, name')
      .eq('token_hash', token_hash)
      .single()

    if (deviceError || !device) {
      throw new Error('Device non trouvé ou token invalide')
    }

    // Update device last_seen + status + geo + version
    const updatePayload: Record<string, any> = {
      last_seen_at: new Date().toISOString(),
      status: 'online',
    }
    if (ip_address) updatePayload.ip_address = ip_address
    if (country) updatePayload.country = country
    if (city) updatePayload.city = city
    if (user_agent) updatePayload.user_agent = user_agent
    if (app_version) updatePayload.app_version = app_version

    const { error: updateError } = await supabaseClient
      .from('devices')
      .update(updatePayload)
      .eq('id', device.id)

    if (updateError) {
      throw new Error('Erreur update device: ' + updateError.message)
    }

    console.log('Heartbeat from device:', device.id, device.name, country || 'Unknown', city || 'Unknown')

    // Plan effectif (ignore anciens plans masqués)
    const { data: plan } = await supabaseClient.rpc('get_effective_plan', { p_org_id: device.org_id })
    const smsQuota = typeof plan?.sms_quota_month === 'number' ? plan.sms_quota_month : 0
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count: usedCount } = await supabaseClient
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', device.org_id)
      .eq('status', 'sent')
      .gte('sent_at', monthStart)
    const used = usedCount || 0
    const quotaRemaining = smsQuota === 0 ? null : Math.max(smsQuota - used, 0)

    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
        device_name: device.name,
        timestamp: new Date().toISOString(),
        plan: plan
          ? { id: plan.id, name: plan.name, max_devices: plan.max_devices, sms_quota_month: plan.sms_quota_month }
          : null,
        sms_used_this_month: used,
        quota_remaining: quotaRemaining,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Heartbeat error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

