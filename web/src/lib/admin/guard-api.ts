import { createClient } from '@/lib/supabase/server'

/**
 * Vérifie si l'utilisateur actuel est admin dans une API Route.
 * @param req - Request object from Next.js API route
 * @returns Role de l'admin ('SUPER_ADMIN' ou 'SUPPORT') ou null si pas admin
 */
export async function requireAdminApi(req: Request): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Chercher dans admin_users pour voir si c'est un admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'SUPPORT')) {
    return null
  }

  return adminUser.role
}
