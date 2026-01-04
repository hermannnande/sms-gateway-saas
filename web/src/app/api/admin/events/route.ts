import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'all'
  const page = Number(url.searchParams.get('page') || '0')
  const pageSize = Number(url.searchParams.get('pageSize') || '50')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_events', {
    p_type: type,
    p_page: page,
    p_page_size: pageSize,
  })

  if (error) {
    const msg = error.message?.includes('admin_only') ? 'Accès refusé' : error.message
    return NextResponse.json({ ok: false, error: msg }, { status: 403 })
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}


