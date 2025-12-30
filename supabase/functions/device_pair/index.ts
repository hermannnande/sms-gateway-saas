// Edge Function: device_pair
// Créer un nouveau device et générer un token sécurisé

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { randomHex, sha256Hex } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { device_name } = await req.json()

    if (!device_name) {
      throw new Error('device_name requis')
    }

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user from auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Non authentifié')
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Non authentifié')
    }

    // Get user's org_id
    const { data: orgMember, error: orgError } = await supabaseClient
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    let org_id: string | null = orgMember?.org_id ?? null

    // Auto-heal: si l'utilisateur n'a pas d'org, créer une org par défaut + membership
    if (!org_id) {
      console.warn('No org_members row found for user, creating default org', user.id)
      const { data: newOrg, error: newOrgError } = await supabaseClient
        .from('organizations')
        .insert({ name: 'Mon organisation' })
        .select('id')
        .single()

      if (newOrgError || !newOrg) {
        throw new Error('Organisation non trouvée (et création impossible)')
      }

      org_id = newOrg.id

      const { error: memberInsertError } = await supabaseClient
        .from('org_members')
        .insert({
          org_id,
          user_id: user.id,
          role: 'ORG_ADMIN',
        })

      if (memberInsertError) {
        throw new Error('Organisation créée, mais membership impossible: ' + memberInsertError.message)
      }
    }

    // Generate secure token (32 bytes = 64 hex chars)
    const device_token = randomHex(32)

    // Hash token for storage
    const token_hash = await sha256Hex(device_token)

    // Create device
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .insert({
        org_id,
        name: device_name,
        token_hash,
        status: 'offline',
      })
      .select()
      .single()

    if (deviceError || !device) {
      throw new Error('Erreur création device: ' + deviceError?.message)
    }

    console.log('Device created:', device.id)

    // Return device info + token (only time we send token!)
    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
        device_token, // Send token ONCE for QR code
        device_name: device.name,
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




