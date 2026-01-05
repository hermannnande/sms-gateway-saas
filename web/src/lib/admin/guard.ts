import { createClient } from '@/lib/supabase/server'

/**
 * Vérifie si l'utilisateur actuel est admin.
 * À utiliser dans les Server Components.
 * @returns Role de l'admin ('super_admin' ou 'admin') ou null si pas admin
 */
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Chercher dans app_users pour voir si c'est un admin
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!appUser || (appUser.role !== 'super_admin' && appUser.role !== 'admin')) {
    return null
  }

  return appUser.role
}
