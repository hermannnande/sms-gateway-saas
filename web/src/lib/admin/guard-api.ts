import { createClient } from '@/lib/supabase/server'

/**
 * Vérifie si l'utilisateur actuel est admin dans une API Route.
 * @param req - Request object from Next.js API route
 * NOTE: On utilise la RPC `admin_role()` (SECURITY DEFINER) car `admin_users`
 * est protégée par RLS et n'est pas lisible directement côté app.
 * @returns Role de l'admin ('SUPER_ADMIN' ou 'SUPPORT') ou null si pas admin
 */
export async function requireAdminApi(_req?: Request): Promise<string | null> {
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()

  if (!auth?.user) {
    return null
  }

  const { data: role, error } = await supabase.rpc('admin_role')
  if (error) return null
  if (role !== 'SUPER_ADMIN' && role !== 'SUPPORT') {
    return null
  }

  return role
}
