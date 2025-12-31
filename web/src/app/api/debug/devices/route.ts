import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const { data: orgMembers, error: orgErr } = await supabase
    .from('org_members')
    .select('org_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (orgErr) {
    return NextResponse.json({ ok: false, step: 'org_members', error: orgErr.message }, { status: 500 })
  }

  const orgIds = (orgMembers ?? []).map((m) => m.org_id)

  const { data: devices, error: devErr } =
    orgIds.length > 0
      ? await supabase.from('devices').select('id, org_id, name, status, created_at').in('org_id', orgIds)
      : { data: [], error: null }

  if (devErr) {
    return NextResponse.json({ ok: false, step: 'devices', error: devErr.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: true,
      userId: user.id,
      orgCount: orgIds.length,
      orgIds,
      deviceCount: (devices ?? []).length,
      devices,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}


