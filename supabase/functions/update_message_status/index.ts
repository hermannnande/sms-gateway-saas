// Edge Function: update_message_status
// Update message status after send attempt (sent/failed)
// Retry policy: max 3 attempts

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
    const message_id = body?.message_id
    const status = body?.status
    const errorMsg = body?.error

    if (!device_token || !message_id || !status) {
      throw new Error('device_token, message_id, status requis')
    }

    if (!['sent', 'failed'].includes(status)) {
      throw new Error('status doit être sent ou failed')
    }

    // Hash token
    const token_hash = await hashToken(device_token)

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify device ownership
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('id, org_id')
      .eq('token_hash', token_hash)
      .single()

    if (deviceError || !device) {
      throw new Error('Device non trouvé')
    }

    // The message state and campaign counter must commit together. This RPC
    // also makes repeated reports idempotent after a lost HTTP response.
    const { data, error } = await supabaseClient.rpc('report_message_status', {
      p_device_id: device.id,
      p_message_id: message_id,
      p_status: status,
      p_error: errorMsg ?? null,
    })
    if (error) throw new Error(error.message)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
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




