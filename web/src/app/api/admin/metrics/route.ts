import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Auth + role check
  const adminRole = await requireAdminApi(req)
  if (!adminRole) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_metrics')

  if (error) {
    const msg = error.message?.includes('admin_only') ? 'Accès refusé' : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}


