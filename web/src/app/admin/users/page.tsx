import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  await requireAdmin()
  const service = createServiceClient()

  const { data: users } = await service
    .from('app_users')
    .select('user_id, email, created_at, last_login_at, last_web_seen_at, last_mobile_seen_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-1">Utilisateurs</h2>
        <p className="text-sm text-muted-foreground">
          100 derniers inscrits (la pagination/filtrage avancés seront ajoutés ensuite).
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Créé</th>
                <th className="px-4 py-3 text-left font-semibold">Dernier login</th>
                <th className="px-4 py-3 text-left font-semibold">Web vu</th>
                <th className="px-4 py-3 text-left font-semibold">Mobile vu</th>
                <th className="px-4 py-3 text-left font-semibold">User ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users || []).map((u) => (
                <tr key={u.user_id}>
                  <td className="px-4 py-3">{u.email || '—'}</td>
                  <td className="px-4 py-3">{u.created_at ? new Date(u.created_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">{u.last_web_seen_at ? new Date(u.last_web_seen_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">{u.last_mobile_seen_at ? new Date(u.last_mobile_seen_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.user_id}</td>
                </tr>
              ))}
              {(users || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


