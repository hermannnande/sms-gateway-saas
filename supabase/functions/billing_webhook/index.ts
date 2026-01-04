// Edge Function: billing_webhook
// Webhook Payfonte pour confirmer paiement
// Vérifie signature HMAC SHA512

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

serve(async (req) => {
  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    console.log('Webhook received:', payload)

    // Verify signature
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-webook-signature') // typo fallback
    const clientSecret = Deno.env.get('PAYFONTE_CLIENT_SECRET')

    if (!signature || !clientSecret) {
      throw new Error('Signature ou secret manquant')
    }

    // Compute HMAC SHA512
    const encoder = new TextEncoder()
    const keyData = encoder.encode(clientSecret)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )

    const signatureData = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const expectedSignature = Array.from(new Uint8Array(signatureData))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (signature !== expectedSignature) {
      console.error('Invalid signature')
      throw new Error('Signature invalide')
    }

    console.log('Signature valid ✓')

    // Process webhook
    const { event, data } = payload

    if (event === 'payment.completed' && data?.status === 'success') {
      // Payment successful
      const externalReference = data.externalReference || data.reference
      const payfonteReference = data.reference

      if (!externalReference) {
        throw new Error('externalReference manquant')
      }

      // Create Supabase client with service role
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // Find payment by external_reference
      const { data: payment, error: paymentError } = await supabaseClient
        .from('payments')
        .select('*')
        .eq('external_reference', externalReference)
        .single()

      if (paymentError || !payment) {
        throw new Error('Payment non trouvé: ' + externalReference)
      }

      // Update payment status
      const { error: updatePaymentError } = await supabaseClient
        .from('payments')
        .update({
          status: 'paid',
          payfonte_reference: payfonteReference,
          paid_at: new Date().toISOString(),
          raw_payload: data,
        })
        .eq('id', payment.id)

      if (updatePaymentError) {
        throw new Error('Erreur update payment: ' + updatePaymentError.message)
      }

      console.log('Payment marked as paid:', payment.id)

      // Activate subscription (30 days)
      const currentPeriodStart = new Date()
      const currentPeriodEnd = new Date()
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30)

      const { error: subError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          org_id: payment.org_id,
          plan_id: payment.plan_id,
          status: 'active',
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          provider: 'payfonte',
          last_payment_id: payment.id,
        })

      if (subError) {
        throw new Error('Erreur activation subscription: ' + subError.message)
      }

      console.log('Subscription activated for org:', payment.org_id)

      return new Response(
        JSON.stringify({ success: true, message: 'Webhook traité' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } else if (data?.status === 'failed') {
      // Payment failed
      const externalReference = data.externalReference || data.reference

      if (externalReference) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        await supabaseClient
          .from('payments')
          .update({
            status: 'failed',
            raw_payload: data,
          })
          .eq('external_reference', externalReference)
      }

      console.log('Payment failed:', externalReference)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook reçu' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})








