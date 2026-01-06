import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createClient } from '@/lib/supabase/server'

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
    const { code, plan_id, duration_days, max_uses, notes, expires_in_days } = body

    if (!code || !plan_id || !duration_days || !max_uses) {
      return NextResponse.json(
        { error: 'code, plan_id, duration_days et max_uses requis' },
        { status: 400 }
      )
    }

    // No service-role key: rely on RLS + admin_role() policies
    const supabase = await createClient()

    // Vérifier que le plan existe
    const { data: plan } = await supabase.from('plans').select('id').eq('id', plan_id).single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 })
    }

    // Calculer la date d'expiration si spécifiée
    let expiresAt = null
    if (expires_in_days) {
      const expDate = new Date()
      expDate.setDate(expDate.getDate() + expires_in_days)
      expiresAt = expDate.toISOString()
    }

    // Créer le code promo
    const { data: promoCode, error } = await supabase
      .from('promo_codes')
      .insert({
        code: code.toUpperCase(),
        plan_id,
        duration_days: parseInt(duration_days),
        max_uses: parseInt(max_uses),
        current_uses: 0,
        notes: notes || null,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // Duplicate key (code existe déjà)
        return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 400 })
      }
      throw error
    }

    console.log(`✅ Admin generated promo code: ${code}`)

    return NextResponse.json({
      ok: true,
      message: 'Code promo généré avec succès',
      promo_code: promoCode,
    })
  } catch (error: any) {
    console.error('❌ Erreur génération code promo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

