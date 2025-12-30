// Edge Function: billing_create_checkout
// Créer un checkout Payfonte et retourner l'URL de paiement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { plan_id } = await req.json()

    if (!plan_id) {
      throw new Error('plan_id requis')
    }

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user from auth
    const authHeader = req.headers.get('Authorization')!
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

    if (orgError || !orgMember) {
      throw new Error('Organisation non trouvée')
    }

    const org_id = orgMember.org_id

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) {
      throw new Error('Plan non trouvé')
    }

    // Calculate amount (Payfonte utilise la plus petite unité)
    // Pour XOF, pas de centimes, donc on utilise directement le montant
    const amount_minor = plan.price_xof

    // Generate external_reference (notre référence unique)
    const external_reference = crypto.randomUUID()

    // Create payment record (pending)
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        org_id,
        plan_id,
        status: 'pending',
        amount_minor,
        currency: 'XOF',
        external_reference,
      })
      .select()
      .single()

    if (paymentError || !payment) {
      throw new Error('Erreur création paiement: ' + paymentError?.message)
    }

    // Call Payfonte API to create checkout
    const payfonteClientId = Deno.env.get('PAYFONTE_CLIENT_ID')
    const payfonteClientSecret = Deno.env.get('PAYFONTE_CLIENT_SECRET')
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'

    if (!payfonteClientId || !payfonteClientSecret) {
      throw new Error('Configuration Payfonte manquante')
    }

    const checkoutPayload = {
      reference: external_reference,
      amount: amount_minor,
      currency: 'XOF',
      country: 'CI',
      user: {
        email: user.email,
        phoneNumber: '',
        name: user.email?.split('@')[0] || 'User',
      },
      redirectURL: `${appUrl}/billing/return?reference=${external_reference}`,
      webhook: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing_webhook`,
    }

    const payfonteResponse = await fetch('https://sandbox-api.payfonte.com/payments/v1/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': payfonteClientId,
        'client-secret': payfonteClientSecret,
      },
      body: JSON.stringify(checkoutPayload),
    })

    if (!payfonteResponse.ok) {
      const errorText = await payfonteResponse.text()
      console.error('Payfonte error:', errorText)
      throw new Error('Erreur Payfonte: ' + payfonteResponse.status)
    }

    const payfonteData = await payfonteResponse.json()

    // Payfonte retourne checkoutURL
    const checkoutURL = payfonteData.checkoutURL || payfonteData.checkout_url

    if (!checkoutURL) {
      console.error('Payfonte response:', payfonteData)
      throw new Error('checkoutURL manquant dans réponse Payfonte')
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutURL,
        reference: external_reference,
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




