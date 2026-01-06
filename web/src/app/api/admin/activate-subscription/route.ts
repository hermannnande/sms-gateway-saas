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

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('admin_activate_subscription', {
      p_plan_id: plan_id,
      p_duration_days: parseInt(String(duration_days), 10),
      p_org_id: org_id || null,
      p_email: (email || '').trim() || null,
      p_user_id: user_id || null,
      p_org_name: org_name || null,
    })

    if (error) {
      const msg = error.message?.includes('admin_only') ? 'Accès refusé' : error.message
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    return NextResponse.json(data || { ok: false, error: 'Réponse vide' }, { status: 200 })
  } catch (error: any) {
    console.error('❌ Erreur activation admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

