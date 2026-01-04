import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export default async function AdminOrgsPage() {
  await requireAdmin()
  const service = createServiceClient()

  const { data: orgs } = await service
    .from('organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch subscriptions for these orgs (batch)
  const orgIds = (orgs || []).map((o) => o.id)
  const { data: subs } = orgIds.length
    ? await service
        .from('subscriptions')
        .select('org_id, status, current_period_end, plans(name)')
        .in('org_id', orgIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
    : { data: [] }

  const byOrg = new Map<string, any>()
  for (const s of subs || []) {
    if (!byOrg.has(s.org_id)) byOrg.set(s.org_id, s)
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-1">Organisations</h2>
        <p className="text-sm text-muted-foreground">
          100 dernières organisations + plan actif (si présent).
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nom</th>
                <th className="px-4 py-3 text-left font-semibold">Créé</th>
                <th className="px-4 py-3 text-left font-semibold">Plan actif</th>
                <th className="px-4 py-3 text-left font-semibold">Fin</th>
                <th className="px-4 py-3 text-left font-semibold">Org ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(orgs || []).map((o) => {
                const s = byOrg.get(o.id)
                const planName = s?.plans?.name || '—'
                const end = s?.current_period_end
                  ? new Date(s.current_period_end).toLocaleDateString('fr-FR')
                  : '—'
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">{o.created_at ? new Date(o.created_at).toLocaleString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3">{planName}</td>
                    <td className="px-4 py-3">{end}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                  </tr>
                )
              })}
              {(orgs || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    Aucune organisation.
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


