import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const adminRole = await requireAdminApi(req)
    if (!adminRole) {
      return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const user_id = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
    const org_name = typeof body?.org_name === 'string' ? body.org_name.trim() : ''
    const org_id = typeof body?.org_id === 'string' ? body.org_id.trim() : ''

    if (!user_id) {
      return NextResponse.json({ ok: false, error: 'user_id requis' }, { status: 400 })
    }

    // Use RPC (SECURITY DEFINER) => no service-role key needed
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('admin_ensure_user_org', {
      p_user_id: user_id,
      p_org_id: org_id || null,
      p_org_name: org_name || null,
    })

    if (error) {
      const msg = error.message?.includes('admin_only') ? 'Accès refusé' : error.message
      return NextResponse.json({ ok: false, error: msg }, { status: 403 })
    }

    return NextResponse.json(data || { ok: false, error: 'Réponse vide' }, { status: 200 })
  } catch (e: any) {
    console.error('admin/ensure-user-org error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}


