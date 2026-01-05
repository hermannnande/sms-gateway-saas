import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const supabaseService = createServiceClient()

    // Vérifier que l'utilisateur est authentifié
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await req.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 })
    }

    const codeUpper = code.trim().toUpperCase()

    // Récupérer l'organisation de l'utilisateur
    const { data: orgMember } = await supabaseService
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!orgMember || !orgMember.org_id) {
      return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 })
    }

    // Vérifier le code promo
    const { data: promoCode } = await supabaseService
      .from('promo_codes')
      .select('*')
      .eq('code', codeUpper)
      .single()

    if (!promoCode) {
      return NextResponse.json({ error: 'Code promo invalide' }, { status: 400 })
    }

    // Vérifications
    if (!promoCode.is_active) {
      return NextResponse.json({ error: 'Ce code promo n\'est plus actif' }, { status: 400 })
    }

    if (promoCode.current_uses >= promoCode.max_uses) {
      return NextResponse.json({ error: 'Ce code promo a atteint sa limite d\'utilisation' }, { status: 400 })
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Ce code promo a expiré' }, { status: 400 })
    }

    // Vérifier si l'utilisateur a déjà utilisé ce code
    const { data: existingRedemption } = await supabaseService
      .from('promo_code_redemptions')
      .select('id')
      .eq('promo_code_id', promoCode.id)
      .eq('org_id', orgMember.org_id)
      .maybeSingle()

    if (existingRedemption) {
      return NextResponse.json({ error: 'Vous avez déjà utilisé ce code promo' }, { status: 400 })
    }

    // Récupérer le plan
    const { data: plan } = await supabaseService
      .from('plans')
      .select('*')
      .eq('id', promoCode.plan_id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan non trouvé' }, { status: 500 })
    }

    // Calculer les dates
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + promoCode.duration_days)

    // Vérifier s'il existe déjà un abonnement actif
    const { data: existingSub } = await supabaseService
      .from('subscriptions')
      .select('id')
      .eq('org_id', orgMember.org_id)
      .eq('status', 'active')
      .maybeSingle()

    let subscriptionId: string

    if (existingSub) {
      // Mettre à jour l'abonnement existant
      const { data: updatedSub, error: updateError } = await supabaseService
        .from('subscriptions')
        .update({
          plan_id: promoCode.plan_id,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', existingSub.id)
        .select()
        .single()

      if (updateError) throw updateError
      subscriptionId = updatedSub.id

      console.log(`✅ Promo code ${codeUpper}: subscription ${existingSub.id} updated for org ${orgMember.org_id}`)
    } else {
      // Créer un nouvel abonnement
      const { data: newSub, error: insertError } = await supabaseService
        .from('subscriptions')
        .insert({
          org_id: orgMember.org_id,
          plan_id: promoCode.plan_id,
          status: 'active',
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
        })
        .select()
        .single()

      if (insertError) throw insertError
      subscriptionId = newSub.id

      console.log(`✅ Promo code ${codeUpper}: new subscription ${newSub.id} created for org ${orgMember.org_id}`)
    }

    // Enregistrer l'utilisation du code
    await supabaseService.from('promo_code_redemptions').insert({
      promo_code_id: promoCode.id,
      org_id: orgMember.org_id,
      user_email: user.email,
      subscription_id: subscriptionId,
    })

    // Incrémenter le compteur d'utilisations
    await supabaseService
      .from('promo_codes')
      .update({ current_uses: promoCode.current_uses + 1 })
      .eq('id', promoCode.id)

    return NextResponse.json({
      ok: true,
      message: `Abonnement activé avec succès ! (${plan.name} pour ${promoCode.duration_days} jours)`,
      subscription: {
        plan_name: plan.name,
        period_end: periodEnd.toISOString(),
        duration_days: promoCode.duration_days,
      },
    })
  } catch (error: any) {
    console.error('❌ Erreur activation code promo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

