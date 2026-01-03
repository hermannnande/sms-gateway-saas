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

    if (!device_token) {
      throw new Error('device_token requis')
    }

    // Hash token to find device
    const token_hash = await hashToken(device_token)

    console.log(`Checking heartbeat for token hash: ${token_hash.slice(0, 8)}...`)

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

    // Update device last_seen + status
    const { error: updateError } = await supabaseClient
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        status: 'online',
      })
      .eq('id', device.id)

    if (updateError) {
      throw new Error('Erreur update device: ' + updateError.message)
    }

    console.log('Heartbeat from device:', device.id, device.name)

    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
        device_name: device.name,
        timestamp: new Date().toISOString(),
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

