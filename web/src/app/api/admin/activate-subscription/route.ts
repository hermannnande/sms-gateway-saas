import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/admin/guard-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Vérifier que c'est un admin
    const adminRole = await requireAdminApi(req)
    if (!adminRole) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { org_id, plan_id, duration_days } = body

    if (!org_id || !plan_id || !duration_days) {
      return NextResponse.json({ error: 'org_id, plan_id et duration_days requis' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Vérifier que le plan existe
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 })
    }

    // Vérifier que l'organisation existe
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', org_id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    // Calculer les dates
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + parseInt(duration_days))

    // Vérifier s'il existe déjà un abonnement actif
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingSub) {
      // Mettre à jour l'abonnement existant
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: plan_id,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
          provider: 'manual_admin',
        })
        .eq('id', existingSub.id)

      if (updateError) {
        throw updateError
      }

      console.log(`✅ Admin activation: subscription ${existingSub.id} updated for org ${org_id}`)
    } else {
      // Créer un nouvel abonnement
      const { data: newSub, error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          org_id: org_id,
          plan_id: plan_id,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          provider: 'manual_admin',
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      console.log(`✅ Admin activation: new subscription ${newSub.id} created for org ${org_id}`)
    }

    // Enregistrer le paiement manuel dans la table payments (schema: amount_minor, status: pending/paid/failed, external_reference)
    // NB: On met paid_at pour marquer le paiement comme effectué.
    const externalReference = `manual_admin_${org_id}_${Date.now()}`
    await supabase.from('payments').insert({
      org_id: org_id,
      plan_id: plan_id,
      status: 'paid',
      amount_minor: plan.price_xof, // XOF => pas de centimes, on garde le même montant
      currency: 'XOF',
      external_reference: externalReference,
      raw_payload: {
        provider: 'manual_admin',
        activated_by: adminRole,
        activation_method: 'manual',
        duration_days: duration_days,
      },
      paid_at: now.toISOString(),
    })

    return NextResponse.json({
      ok: true,
      message: 'Abonnement activé avec succès',
      subscription: {
        plan: plan.name,
        current_period_end: periodEnd.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('❌ Erreur activation admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

