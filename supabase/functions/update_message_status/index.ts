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

    // Get message
    const { data: message, error: msgError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single()

    if (msgError || !message) {
      throw new Error('Message non trouvé')
    }

    // Verify message belongs to device's org
    if (message.org_id !== device.org_id) {
      throw new Error('Message n\'appartient pas à cette org')
    }

    // Update message based on status
    if (status === 'sent') {
      // Mark as sent
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', message_id)

      if (updateError) {
        throw new Error('Erreur update sent: ' + updateError.message)
      }

      console.log('Message marked as sent:', message_id)

      // Update device last_seen
      await supabaseClient
        .from('devices')
        .update({
          last_seen_at: new Date().toISOString(),
          status: 'online',
        })
        .eq('id', device.id)

      // Increment campaign sent_count if applicable
      if (message.campaign_id) {
        const { data: campaign } = await supabaseClient
          .from('campaigns')
          .select('sent_count,total_count,status')
          .eq('id', message.campaign_id)
          .single()

        const newSent = (campaign?.sent_count || 0) + 1
        const updatePayload: Record<string, unknown> = { sent_count: newSent }

        // Finalize the campaign as soon as ALL its messages are in a terminal
        // state (sent / failed / skipped_optout). Using sent_count alone is not
        // sufficient because skipped_optout messages never become "sent".
        try {
          const { count: terminalCount } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', message.campaign_id)
            .in('status', ['sent', 'failed', 'skipped_optout'])

          const total = campaign?.total_count ?? 0
          if (total > 0 && (terminalCount ?? 0) >= total) {
            updatePayload.status = 'done'
          }
        } catch (_) {
          if (campaign?.total_count && campaign.total_count > 0 && newSent >= campaign.total_count) {
            updatePayload.status = 'done'
          }
        }

        await supabaseClient
          .from('campaigns')
          .update(updatePayload)
          .eq('id', message.campaign_id)
      }

      return new Response(
        JSON.stringify({ success: true, status: 'sent' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else if (status === 'failed') {
      // Increment try_count
      const newTryCount = message.try_count + 1
      const maxRetries = 3

      if (newTryCount < maxRetries) {
        // Retry: put back to queued
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            status: 'queued',
            try_count: newTryCount,
            last_error: errorMsg || 'Unknown error',
            device_id: null, // Release device lock
          })
          .eq('id', message_id)

        if (updateError) {
          throw new Error('Erreur update retry: ' + updateError.message)
        }

        console.log(`Message retry ${newTryCount}/${maxRetries}:`, message_id)

        return new Response(
          JSON.stringify({
            success: true,
            status: 'queued_retry',
            try_count: newTryCount,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      } else {
        // Max retries reached: mark as failed permanently
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            status: 'failed',
            try_count: newTryCount,
            last_error: errorMsg || 'Max retries reached',
          })
          .eq('id', message_id)

        if (updateError) {
          throw new Error('Erreur update failed: ' + updateError.message)
        }

        console.log('Message failed permanently:', message_id)

        // Also try to finalize the campaign now that this message is terminal.
        if (message.campaign_id) {
          try {
            const { data: campaign } = await supabaseClient
              .from('campaigns')
              .select('total_count,status')
              .eq('id', message.campaign_id)
              .single()

            if (campaign && campaign.status !== 'done' && campaign.status !== 'canceled') {
              const { count: terminalCount } = await supabaseClient
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', message.campaign_id)
                .in('status', ['sent', 'failed', 'skipped_optout'])

              const total = campaign.total_count ?? 0
              if (total > 0 && (terminalCount ?? 0) >= total) {
                await supabaseClient
                  .from('campaigns')
                  .update({ status: 'done' })
                  .eq('id', message.campaign_id)
              }
            }
          } catch (_) {
            // non-blocking
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: 'failed',
            try_count: newTryCount,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    throw new Error('Status invalide')
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




