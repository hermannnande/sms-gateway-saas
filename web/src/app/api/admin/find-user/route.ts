import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/admin/guard-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const adminRole = await requireAdminApi(req)
    if (!adminRole) {
      return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
    }

    const url = new URL(req.url)
    const emailRaw = (url.searchParams.get('email') || '').trim().toLowerCase()
    if (!emailRaw) {
      return NextResponse.json({ ok: false, error: 'email requis' }, { status: 400 })
    }

    // Use RPC (SECURITY DEFINER) => no service-role key needed and no RLS issues
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('admin_find_user', { p_email: emailRaw })
    if (error) {
      const msg = error.message?.includes('admin_only') ? 'Accès refusé' : error.message
      return NextResponse.json({ ok: false, error: msg }, { status: 403 })
    }

    const payload = (data || { ok: false, error: 'Réponse vide' }) as any
    const status = payload?.ok === false ? 404 : 200
    return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('admin/find-user error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}


