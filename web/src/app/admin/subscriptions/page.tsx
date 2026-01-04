import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  await requireAdmin()
  const service = createServiceClient()

  const { data: subs } = await service
    .from('subscriptions')
    .select('id, org_id, plan_id, status, current_period_start, current_period_end, provider, created_at, plans(name, price_xof, max_devices, sms_quota_month)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-1">Abonnements</h2>
        <p className="text-sm text-muted-foreground">
          200 derniers abonnements (gestion avancée à venir).
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
                <th className="px-4 py-3 text-left font-semibold">Début</th>
                <th className="px-4 py-3 text-left font-semibold">Fin</th>
                <th className="px-4 py-3 text-left font-semibold">Provider</th>
                <th className="px-4 py-3 text-left font-semibold">Org</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(subs || []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{s.plans?.name || s.plan_id}</td>
                  <td className="px-4 py-3">{s.status}</td>
                  <td className="px-4 py-3">{s.current_period_start ? new Date(s.current_period_start).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">{s.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.org_id}</td>
                </tr>
              ))}
              {(subs || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                    Aucun abonnement.
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


