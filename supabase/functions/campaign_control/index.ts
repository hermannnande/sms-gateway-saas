// Edge Function: campaign_control
// Actions: pause / resume / cancel a campaign job

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'pause' | 'resume' | 'cancel'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, campaign_id } = await req.json()
    const act = (action as Action) ?? null

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

    // Auth user
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      throw new Error('Non authentifié')
    }

    // Find org of user
    const { data: member, error: memberError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userData.user.id)
      .single()
    if (memberError || !member) {
      throw new Error('Organisation introuvable')
    }

    const org_id = member.org_id

    // Check campaign belongs to org
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('id, org_id, status')
      .eq('id', campaign_id)
      .single()
    if (campError || !campaign || campaign.org_id !== org_id) {
      throw new Error('Campagne introuvable ou non autorisée')
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
      JSON.stringify({ success: true, campaign_id, action: act }),
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






