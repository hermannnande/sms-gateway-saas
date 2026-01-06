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
    const { device_name, android_id } = await req.json()

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

    // Get user's org_id (take the first membership to avoid `.single()` errors when multiple rows exist)
    const { data: orgMembers, error: orgError } = await supabaseClient
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)

    let org_id: string | null = orgMembers?.[0]?.org_id ?? null

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

    // Récupérer le plan effectif (pour max_devices)
    let maxDevices: number | null = null
    try {
      const { data: plan } = await supabaseClient.rpc('get_effective_plan', { p_org_id: org_id })
      maxDevices = typeof (plan as any)?.max_devices === 'number' ? (plan as any).max_devices : null
    } catch (_) {
      maxDevices = null
    }

    // Generate secure token (32 bytes = 64 hex chars)
    const device_token = randomHex(32)

    // Hash token for storage
    const token_hash = await sha256Hex(device_token)

    let device: any = null

    // Si android_id est fourni, vérifier si un device existant avec ce android_id existe pour cette org
    if (android_id) {
      const { data: existingDevice } = await supabaseClient
        .from('devices')
        .select('id, name, android_id')
        .eq('org_id', org_id)
        .eq('android_id', android_id)
        .maybeSingle()

      if (existingDevice) {
        // Réutiliser l'appareil existant : mettre à jour le token_hash et le nom
        console.log('Existing device found for android_id, reusing:', existingDevice.id)
        const { data: updatedDevice, error: updateError } = await supabaseClient
          .from('devices')
          .update({
            name: device_name,
            token_hash,
            android_id,
            status: 'offline',
            // NOTE: la table `devices` n'a pas de colonne `updated_at` dans le schéma actuel.
          })
          .eq('id', existingDevice.id)
          .select()
          .single()

        if (updateError || !updatedDevice) {
          throw new Error('Erreur mise à jour device: ' + updateError?.message)
        }
        device = updatedDevice
        console.log('Device updated:', device.id)
      }
    }

    // Si pas trouvé par android_id, et que la limite est atteinte, on peut réutiliser le seul device
    // (cas plan 1 appareil + réinstallation: l'ancien device n'avait pas android_id).
    if (!device && maxDevices !== null) {
      const { count: devicesCount } = await supabaseClient
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org_id)

      if (typeof devicesCount === 'number' && devicesCount >= maxDevices) {
        if (maxDevices === 1) {
          const { data: onlyDevice } = await supabaseClient
            .from('devices')
            .select('id')
            .eq('org_id', org_id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (onlyDevice?.id) {
            console.log('Max devices reached (1). Reusing existing device:', onlyDevice.id)
            const { data: updatedDevice, error: updateError } = await supabaseClient
              .from('devices')
              .update({
                name: device_name,
                token_hash,
                android_id: android_id || null,
                status: 'offline',
              })
              .eq('id', onlyDevice.id)
              .select()
              .single()

            if (updateError || !updatedDevice) {
              throw new Error('Erreur mise à jour device: ' + updateError?.message)
            }
            device = updatedDevice
          }
        }

        // Si on n'a pas pu réutiliser => erreur limite
        if (!device) {
          throw new Error(`Limite d'appareils atteinte (${devicesCount}/${maxDevices}). Passez à un plan supérieur.`)
        }
      }
    }

    // Si pas de device existant trouvé (ou pas d'android_id), créer un nouveau device
    if (!device) {
      const { data: newDevice, error: deviceError } = await supabaseClient
        .from('devices')
        .insert({
          org_id,
          name: device_name,
          token_hash,
          android_id: android_id || null,
          status: 'offline',
        })
        .select()
        .single()

      if (deviceError || !newDevice) {
        throw new Error('Erreur création device: ' + deviceError?.message)
      }
      device = newDevice
      console.log('Device created:', device.id)
    }

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




