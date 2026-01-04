import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT'

export async function requireAdmin(): Promise<{ userId: string; role: AdminRole }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: role, error } = await supabase.rpc('admin_role')
  if (error || !role) {
    redirect('/dashboard')
  }

  return { userId: user.id, role: role as AdminRole }
}


