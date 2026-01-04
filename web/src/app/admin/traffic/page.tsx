import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'

export const dynamic = 'force-dynamic'

export default async function AdminTrafficPage() {
  await requireAdmin()
  const service = createServiceClient()

  const now = new Date()
  const last5m = new Date(now.getTime() - 5 * 60 * 1000)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [{ count: activeWeb5m }, { count: apkDownloadsToday }] = await Promise.all([
    service
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_type', 'web_ping')
      .gte('occurred_at', last5m.toISOString()),
    service
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'apk_download')
      .gte('occurred_at', todayStart.toISOString()),
  ])

  const { data: lastEvents } = await service
    .from('analytics_events')
    .select('event_type, occurred_at, platform, user_id, org_id, device_id, meta')
    .order('occurred_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-1">Trafic & activité</h2>
        <p className="text-sm text-muted-foreground">
          Temps réel approximatif (basé sur events). Les dashboards détaillés seront ajoutés ensuite.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Actifs Web (5 min)</div>
          <div className="text-3xl font-bold">{activeWeb5m || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Téléchargements APK (aujourd’hui)</div>
          <div className="text-3xl font-bold">{apkDownloadsToday || 0}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">Derniers événements</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Plateforme</th>
                <th className="px-4 py-3 text-left font-semibold">Heure</th>
                <th className="px-4 py-3 text-left font-semibold">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(lastEvents || []).map((e, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 font-medium">{e.event_type}</td>
                  <td className="px-4 py-3">{e.platform}</td>
                  <td className="px-4 py-3">{new Date(e.occurred_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 font-mono text-xs max-w-[520px] truncate">{JSON.stringify(e.meta)}</td>
                </tr>
              ))}
              {(lastEvents || []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
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


