// Edge Function: device_update_sim
// Update device selected SIM (subscriptionId from Android)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeHex } from 'https://deno.land/std@0.168.0/encoding/hex.ts'
import { normalizeDeviceToken } from '../_shared/device_token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-token',
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return encodeHex(new Uint8Array(hashBuffer))
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const device_token = normalizeDeviceToken(body?.device_token)
    const sim_subscription_id = body?.sim_subscription_id

    if (!device_token || !sim_subscription_id) {
      throw new Error('device_token et sim_subscription_id requis')
    }

    // Hash token
    const token_hash = await hashToken(device_token)

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find device by token_hash
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('token_hash', token_hash)
      .single()

    if (deviceError || !device) {
      throw new Error('Device non trouvé')
    }

    // Update selected_subscription_id + last_seen
    const { error: updateError } = await supabaseClient
      .from('devices')
      .update({
        selected_subscription_id: sim_subscription_id,
        last_seen_at: new Date().toISOString(),
        status: 'online',
      })
      .eq('id', device.id)

    if (updateError) {
      throw new Error('Erreur update device: ' + updateError.message)
    }

    console.log('Device SIM updated:', device.id, sim_subscription_id)

    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})







