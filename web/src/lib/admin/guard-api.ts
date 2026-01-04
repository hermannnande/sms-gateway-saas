import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function requireAdminApi() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const service = createServiceClient()
  const { data: adminRow } = await service
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow?.role) {
    return { ok: false as const, response: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }

  return { ok: true as const, userId: user.id, role: adminRow.role as 'SUPER_ADMIN' | 'SUPPORT', service }
}


