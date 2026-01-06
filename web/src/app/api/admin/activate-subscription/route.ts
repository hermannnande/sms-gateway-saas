import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function defaultOrgName(email: string) {
  const local = email.split('@')[0] || 'client'
  const safe = local.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'client'
  return `Organisation ${safe}`
}

export async function POST(req: Request) {
  try {
    // Vérifier que c'est un admin
    const adminRole = await requireAdminApi(req)
    if (!adminRole) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const {
      org_id,
      plan_id,
      duration_days,
      email,
      user_id,
      org_name,
    }: {
      org_id?: string
      plan_id?: string
      duration_days?: number | string
      email?: string
      user_id?: string
      org_name?: string
    } = body || {}

    if (!plan_id || !duration_days) {
      return NextResponse.json({ error: 'plan_id et duration_days requis' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Résoudre org_id si absent: email/user_id => ensure org_members
    let resolvedOrgId = typeof org_id === 'string' ? org_id.trim() : ''
    const resolvedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    let resolvedUserId = typeof user_id === 'string' ? user_id.trim() : ''

    if (!resolvedOrgId) {
      if (!resolvedUserId) {
        if (!resolvedEmail) {
          return NextResponse.json(
            { error: 'org_id ou (email/user_id) requis pour activer un abonnement' },
            { status: 400 }
          )
        }
        // Trouver user_id via RPC admin_list_users (SECURITY DEFINER)
        const sb = await createClient()
        const { data: list, error: listError } = await sb.rpc('admin_list_users', {
          p_search: resolvedEmail,
          p_status: 'all',
          p_page: 0,
          p_page_size: 10,
        })
        if (listError) {
          const msg = listError.message?.includes('admin_only') ? 'Accès refusé' : listError.message
          return NextResponse.json({ error: msg }, { status: 403 })
        }
        const items: any[] = (list?.items || list?.data?.items || []) as any[]
        const u = items.find((x) => (x?.email || '').toLowerCase() === resolvedEmail) || null
        resolvedUserId = u?.user_id || u?.id || ''
        if (!resolvedUserId) {
          return NextResponse.json({ error: `Utilisateur introuvable: ${resolvedEmail}` }, { status: 404 })
        }
      }

      // Chercher org existante pour ce user (la plus récente)
      const { data: member } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (member?.org_id) {
        resolvedOrgId = member.org_id
      } else {
        // Créer org + membership automatiquement (admin ne veut pas gérer ça)
        const name =
          (typeof org_name === 'string' && org_name.trim()) ||
          (resolvedEmail ? defaultOrgName(resolvedEmail) : 'Organisation client')
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .insert({ name })
          .select('id')
          .single()
        if (orgErr || !org?.id) throw orgErr || new Error("Impossible de créer l'organisation")

        const { error: memberErr } = await supabase.from('org_members').insert({
          org_id: org.id,
          user_id: resolvedUserId,
          role: 'ORG_ADMIN',
        })
        if (memberErr) throw memberErr
        resolvedOrgId = org.id
      }
    }

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
      .eq('id', resolvedOrgId)
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
      .eq('org_id', resolvedOrgId)
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
          org_id: resolvedOrgId,
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
    const externalReference = `manual_admin_${resolvedOrgId}_${Date.now()}`
    await supabase.from('payments').insert({
      org_id: resolvedOrgId,
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
      org_id: resolvedOrgId,
    })
  } catch (error: any) {
    console.error('❌ Erreur activation admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

