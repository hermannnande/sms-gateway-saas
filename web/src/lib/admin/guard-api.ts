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

  const { data: role, error } = await supabase.rpc('admin_role')
  if (error || !role) {
    return { ok: false as const, response: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }

  // NOTE: On garde le client service pour les requêtes globales (si configuré).
  // Si la clé service-role est absente, les routes qui en dépendent renverront une erreur claire.
  const service = createServiceClient()
  return { ok: true as const, userId: user.id, role: role as 'SUPER_ADMIN' | 'SUPPORT', service }
}


