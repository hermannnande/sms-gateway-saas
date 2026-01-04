import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT'

export async function requireAdmin(): Promise<{ userId: string; role: AdminRole }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const service = createServiceClient()
  const { data: adminRow } = await service
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow?.role) {
    redirect('/dashboard')
  }

  return { userId: user.id, role: adminRow.role as AdminRole }
}


