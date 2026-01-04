import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export default async function AdminEventsPage() {
  await requireAdmin()
  const service = createServiceClient()

  const { data: events } = await service
    .from('analytics_events')
    .select('event_type, occurred_at, platform, user_id, org_id, device_id, meta')
    .order('occurred_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-1">Événements (logs)</h2>
        <p className="text-sm text-muted-foreground">200 derniers événements.</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Heure</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Plateforme</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Org</th>
                <th className="px-4 py-3 text-left font-semibold">Device</th>
                <th className="px-4 py-3 text-left font-semibold">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(events || []).map((e, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(e.occurred_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 font-medium">{e.event_type}</td>
                  <td className="px-4 py-3">{e.platform}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.user_id || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.org_id || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.device_id || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs max-w-[520px] truncate">{JSON.stringify(e.meta)}</td>
                </tr>
              ))}
              {(events || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                    Aucun événement.
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


