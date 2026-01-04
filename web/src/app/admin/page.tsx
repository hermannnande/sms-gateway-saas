import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/guard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  await requireAdmin()
  const service = createServiceClient()

  const [{ count: usersTotal }, { count: orgsTotal }, { count: devicesTotal }] = await Promise.all([
    service.from('app_users').select('*', { count: 'exact', head: true }),
    service.from('organizations').select('*', { count: 'exact', head: true }),
    service.from('devices').select('*', { count: 'exact', head: true }),
  ])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)

  const [{ count: downloadsToday }, { count: downloadsMonth }] = await Promise.all([
    service
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'apk_download')
      .gte('occurred_at', todayStart.toISOString()),
    service
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'apk_download')
      .gte('occurred_at', monthStart.toISOString()),
  ])

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-1">Vue d’ensemble</h2>
        <p className="text-sm text-muted-foreground">
          KPIs globaux (base + tracking). Les graphs/UX seront peaufinés ensuite.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Utilisateurs</div>
          <div className="text-3xl font-bold">{usersTotal || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Organisations</div>
          <div className="text-3xl font-bold">{orgsTotal || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Appareils</div>
          <div className="text-3xl font-bold">{devicesTotal || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Téléchargements APK</div>
          <div className="text-3xl font-bold">{downloadsMonth || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Aujourd&apos;hui: {downloadsToday || 0}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-bold mb-3">Accès rapide</h3>
        <div className="flex flex-wrap gap-3">
          <Link className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm" href="/admin/users">
            Utilisateurs
          </Link>
          <Link className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm" href="/admin/orgs">
            Organisations
          </Link>
          <Link className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm" href="/admin/subscriptions">
            Abonnements
          </Link>
          <Link className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm" href="/admin/traffic">
            Trafic
          </Link>
          <Link className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm" href="/admin/events">
            Logs
          </Link>
        </div>
      </div>
    </div>
  )
}


