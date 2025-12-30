// Edge Function: billing_verify
// Vérifier le statut d'un paiement via Payfonte

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { reference } = await req.json()

    if (!reference) {
      throw new Error('reference requise')
    }

    const payfonteClientId = Deno.env.get('PAYFONTE_CLIENT_ID')
    const payfonteClientSecret = Deno.env.get('PAYFONTE_CLIENT_SECRET')

    if (!payfonteClientId || !payfonteClientSecret) {
      throw new Error('Configuration Payfonte manquante')
    }

    // Call Payfonte verify API
    const verifyResponse = await fetch(
      `https://sandbox-api.payfonte.com/payments/v1/payments/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'client-id': payfonteClientId,
          'client-secret': payfonteClientSecret,
        },
      }
    )

    if (!verifyResponse.ok) {
      throw new Error('Erreur vérification Payfonte: ' + verifyResponse.status)
    }

    const verifyData = await verifyResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        status: verifyData.status,
        data: verifyData,
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




