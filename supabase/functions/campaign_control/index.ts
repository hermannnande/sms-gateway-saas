// Edge Function: campaign_control
// Actions: pause / resume / cancel a campaign job

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { hashToken } from '../_shared/crypto.ts'
import { normalizeDeviceToken } from '../_shared/device_token.ts'

type Action = 'pause' | 'resume' | 'cancel'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, campaign_id } = body ?? {}
    const act = (action as Action) ?? null
    const device_token = normalizeDeviceToken(body?.device_token)

    if (!act || !['pause', 'resume', 'cancel'].includes(act)) {
      throw new Error('action doit être pause | resume | cancel')
    }
    if (!campaign_id) {
      throw new Error('campaign_id requis')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Résoudre org_id: essayer JWT d'abord (plus fiable pour l'app), puis device_token en fallback
    let org_id: string | null = null
    let via: 'device_token' | 'user_jwt' = 'user_jwt'

    // 1) Essayer JWT user (mode web OU mode app avec session active)
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwtToken = authHeader.replace('Bearer ', '').trim()
    if (jwtToken && jwtToken.length > 50) {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser(jwtToken)
        if (!userError && userData?.user) {
          const { data: members } = await supabase
            .from('org_members')
            .select('org_id')
            .eq('user_id', userData.user.id)
            .limit(1)
          if (members && members.length > 0) {
            org_id = members[0].org_id
            via = 'user_jwt'
          }
        }
      } catch (_) {
        // JWT invalide ou expiré, on continue avec device_token
      }
    }

    // 2) Fallback: device_token
    if (!org_id && device_token) {
      via = 'device_token'
      const token_hash = await hashToken(device_token)
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, org_id')
        .eq('token_hash', token_hash)
        .single()
      if (devErr || !device?.org_id) {
        throw new Error('Device introuvable (token invalide)')
      }
      org_id = device.org_id
    }

    if (!org_id) {
      throw new Error('Non authentifié: ni JWT ni device_token valide')
    }

    // Check campaign belongs to org
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('id, org_id, status')
      .eq('id', campaign_id)
      .single()

    if (campError || !campaign) {
      throw new Error(`Campagne ${campaign_id} introuvable dans la base`)
    }

    // Si l'org ne correspond pas, essayer de trouver la bonne org via la campagne
    if (campaign.org_id !== org_id) {
      // Vérifier si l'utilisateur a accès à l'org de la campagne
      if (via === 'user_jwt' && jwtToken) {
        const { data: userData } = await supabase.auth.getUser(jwtToken)
        if (userData?.user) {
          const { data: memberCheck } = await supabase
            .from('org_members')
            .select('org_id')
            .eq('user_id', userData.user.id)
            .eq('org_id', campaign.org_id)
            .maybeSingle()
          if (memberCheck) {
            org_id = campaign.org_id
          }
        }
      }
      if (campaign.org_id !== org_id) {
        console.error('org_id mismatch', { campaign_org: campaign.org_id, resolved_org: org_id, via })
        throw new Error('Campagne introuvable ou non autorisée (org mismatch)')
      }
    }

    const now = new Date().toISOString()

    if (act === 'pause') {
      await supabase
        .from('campaigns')
        .update({ status: 'paused', paused_at: now })
        .eq('id', campaign_id)

      await supabase
        .from('campaign_jobs')
        .update({ status: 'paused', ended_at: null })
        .eq('campaign_id', campaign_id)
        .in('status', ['running', 'queued'])

      // If no job existed, insert a paused one for traceability
      const { count } = await supabase
        .from('campaign_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign_id)
      if (!count || count === 0) {
        await supabase
          .from('campaign_jobs')
          .insert({
            org_id,
            campaign_id,
            status: 'paused',
            started_at: now,
          })
      }
    }

    if (act === 'resume') {
      await supabase
        .from('campaigns')
        .update({ status: 'running', paused_at: null, canceled_at: null })
        .eq('id', campaign_id)

      // Put job to running (or create one)
      const { data: job } = await supabase
        .from('campaign_jobs')
        .select('id, status')
        .eq('campaign_id', campaign_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (job?.id) {
        await supabase
          .from('campaign_jobs')
          .update({ status: 'running', started_at: now, ended_at: null })
          .eq('id', job.id)
      } else {
        await supabase
          .from('campaign_jobs')
          .insert({
            org_id,
            campaign_id,
            status: 'running',
            started_at: now,
          })
      }
    }

    if (act === 'cancel') {
      await supabase
        .from('campaigns')
        .update({ status: 'canceled', canceled_at: now })
        .eq('id', campaign_id)

      await supabase
        .from('campaign_jobs')
        .update({ status: 'canceled', ended_at: now })
        .eq('campaign_id', campaign_id)
        .in('status', ['running', 'queued', 'paused'])

      // Mark remaining queued/sending messages as failed/skipped
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          last_error: 'canceled',
          device_id: null,
        })
        .eq('campaign_id', campaign_id)
        .in('status', ['queued', 'sending'])
    }

    return new Response(
      JSON.stringify({ success: true, campaign_id, action: act, via }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('campaign_control error', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})






