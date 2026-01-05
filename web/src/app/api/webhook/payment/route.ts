import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Mapping montant → plan_id
const AMOUNT_TO_PLAN: Record<number, string> = {
  9900: 'monthly_1',   // Plan 1 appareil
  15900: 'monthly_3',  // Plan 3 appareils
  22900: 'monthly_5',  // Plan 5 appareils
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Log complet pour debug
    console.log('📥 Webhook payment reçu:', JSON.stringify(body, null, 2))

    // Extraire les infos importantes (format flexible)
    const amount = extractAmount(body)
    const customerEmail = extractEmail(body)
    const customerPhone = extractPhone(body)
    const status = extractStatus(body)
    const reference = extractReference(body)

    console.log('📊 Données extraites:', { amount, customerEmail, customerPhone, status, reference })

    // Vérifier que le paiement est réussi
    if (status !== 'success' && status !== 'completed' && status !== 'paid') {
      console.log('⚠️ Paiement non confirmé, statut:', status)
      return NextResponse.json({ ok: true, message: 'Payment not confirmed yet' }, { status: 200 })
    }

    // Vérifier qu'on a un montant valide
    if (!amount || !AMOUNT_TO_PLAN[amount]) {
      console.error('❌ Montant invalide ou non reconnu:', amount)
      return NextResponse.json({ ok: false, error: 'Invalid amount' }, { status: 400 })
    }

    // Identifier le client (par email ou téléphone)
    const supabase = createServiceClient()
    
    let userId: string | null = null
    let orgId: string | null = null

    // Chercher par email d'abord
    if (customerEmail) {
      const { data: user } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', customerEmail)
        .maybeSingle()
      
      if (user) {
        userId = user.id
        console.log('✅ Client trouvé par email:', customerEmail)
      }
    }

    // Si pas trouvé par email, chercher par téléphone
    if (!userId && customerPhone) {
      const { data: user } = await supabase
        .from('app_users')
        .select('id')
        .eq('phone', customerPhone)
        .maybeSingle()
      
      if (user) {
        userId = user.id
        console.log('✅ Client trouvé par téléphone:', customerPhone)
      }
    }

    if (!userId) {
      console.error('❌ Client non trouvé avec email:', customerEmail, 'ou téléphone:', customerPhone)
      return NextResponse.json({ 
        ok: false, 
        error: 'Customer not found. Please register first at https://smsenvoie.com/auth/register' 
      }, { status: 404 })
    }

    // Récupérer l'organisation du client
    const { data: member } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!member) {
      console.error('❌ Organisation non trouvée pour userId:', userId)
      return NextResponse.json({ ok: false, error: 'Organization not found' }, { status: 404 })
    }

    orgId = member.org_id

    // Récupérer le plan correspondant au montant
    const planId = AMOUNT_TO_PLAN[amount]
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (!plan) {
      console.error('❌ Plan non trouvé:', planId)
      return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 404 })
    }

    console.log('📦 Plan sélectionné:', plan.name, '-', plan.price_xof, 'XOF')

    // Créer l'abonnement (30 jours)
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + 30)

    // Vérifier s'il existe déjà un abonnement actif
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle()

    if (existingSub) {
      // Mettre à jour l'abonnement existant
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: planId,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', existingSub.id)

      if (updateError) {
        console.error('❌ Erreur mise à jour abonnement:', updateError)
        throw updateError
      }

      console.log('✅ Abonnement mis à jour:', existingSub.id)
    } else {
      // Créer un nouvel abonnement
      const { data: newSub, error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          org_id: orgId,
          plan_id: planId,
          status: 'active',
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Erreur création abonnement:', insertError)
        throw insertError
      }

      console.log('✅ Nouvel abonnement créé:', newSub.id)
    }

    // Enregistrer le paiement dans la table payments
    await supabase
      .from('payments')
      .insert({
        org_id: orgId,
        plan_id: planId,
        amount_xof: amount,
        status: 'completed',
        provider: 'webhook',
        provider_payment_id: reference || `webhook_${Date.now()}`,
        metadata: body, // Stocker le payload complet pour référence
      })

    console.log('✅ Paiement enregistré pour org:', orgId, '- Plan:', plan.name)

    return NextResponse.json({ 
      ok: true, 
      message: `Subscription activated: ${plan.name}`,
      subscription: {
        plan: plan.name,
        period_end: periodEnd.toISOString(),
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ Erreur webhook payment:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// Fonctions pour extraire les données de différents formats de webhook
function extractAmount(body: any): number | null {
  // Essayer différents champs possibles
  const amount = body.amount || body.montant || body.total || body.price || body.value
  if (!amount) return null
  
  // Convertir en nombre
  const num = typeof amount === 'number' ? amount : parseFloat(amount)
  return isNaN(num) ? null : Math.round(num)
}

function extractEmail(body: any): string | null {
  return body.email || 
         body.customer_email || 
         body.customerEmail || 
         body.client_email || 
         body.user_email || 
         null
}

function extractPhone(body: any): string | null {
  return body.phone || 
         body.telephone || 
         body.customer_phone || 
         body.customerPhone || 
         body.client_phone || 
         body.mobile || 
         null
}

function extractStatus(body: any): string | null {
  const status = body.status || body.statut || body.state || body.payment_status || 'unknown'
  return status.toString().toLowerCase()
}

function extractReference(body: any): string | null {
  return body.reference || 
         body.ref || 
         body.transaction_id || 
         body.transactionId || 
         body.payment_id || 
         body.id || 
         null
}

// GET pour tester que l'endpoint est accessible
export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    service: 'webhook/payment',
    message: 'Webhook endpoint is ready',
    supported_plans: AMOUNT_TO_PLAN,
  })
}

