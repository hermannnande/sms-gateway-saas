import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DevicesList } from './devices-list'
import { AddDeviceButton } from './add-device-button'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

export const dynamic = 'force-dynamic'

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const currentPage = parseInt(params.page || '1', 10)
  const itemsPerPage = 10

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's org_id (all orgs, oldest first to be consistent)
  const { data: orgMembers, error: orgError } = await supabase
    .from('org_members')
    .select('org_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (orgError) {
    console.error('Error fetching org_members:', orgError)
  }

  let orgIds = (orgMembers ?? []).map((m) => m.org_id)

  // Auto-heal: if user has no org, create one so devices can be attached & visible
  if (orgIds.length === 0) {
    const orgId = crypto.randomUUID()
    await supabase.from('organizations').insert({ id: orgId, name: 'Mon organisation' })
    await supabase.from('org_members').insert({ org_id: orgId, user_id: user.id, role: 'ORG_ADMIN' })
    orgIds = [orgId]
  }

  // Get total devices count
  const { count: totalCount } = orgIds.length > 0
    ? await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .in('org_id', orgIds)
    : { count: 0 }

  // Get paginated devices
  const from = (currentPage - 1) * itemsPerPage
  const to = from + itemsPerPage - 1

  const { data: devices } = orgIds.length > 0
    ? await supabase
        .from('devices')
        .select('*')
        .in('org_id', orgIds)
        .order('created_at', { ascending: false })
        .range(from, to)
    : { data: [] }

  // Get subscription (for max_devices check)
  const { data: subscription } = orgIds.length > 0
    ? await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('org_id', orgIds[0])
        .eq('status', 'active')
        .single()
    : { data: null }

  const maxDevices = subscription?.plans?.max_devices || 10
  const canAddDevice = (totalCount || 0) < maxDevices

  // Calculate online devices
  const onlineCount =
    devices?.filter(
      (d) =>
        d.last_seen_at &&
        Date.now() - new Date(d.last_seen_at).getTime() < 5 * 60 * 1000
    ).length || 0

  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appareils Gateway"
        description={`Gérez vos appareils Android pour l'envoi de SMS`}
        icon={<>📱</>}
        actions={<AddDeviceButton canAdd={canAddDevice} />}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Appareils"
          value={totalCount || 0}
          icon={<>📱</>}
          description={`Sur ${maxDevices} max`}
        />
        <StatCard
          title="En ligne"
          value={onlineCount}
          icon={<>✅</>}
          description="Actifs maintenant"
        />
        <StatCard
          title="Hors ligne"
          value={(totalCount || 0) - onlineCount}
          icon={<>⚪</>}
          description="Inactifs"
        />
        <StatCard
          title="Disponibles"
          value={maxDevices - (totalCount || 0)}
          icon={<>➕</>}
          description="Slots restants"
        />
      </div>

      {/* Subscription info */}
      {subscription ? (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <div className="text-2xl">✅</div>
          <p className="text-sm text-green-800 dark:text-green-400">
            Plan <span className="font-bold">{subscription.plans?.name}</span> : jusqu'à{' '}
            <span className="font-bold">{maxDevices}</span> appareil{maxDevices > 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3">
          <div className="text-2xl">💡</div>
          <p className="text-sm text-blue-800 dark:text-blue-400">
            Mode développement : <span className="font-bold">{maxDevices}</span> appareil
            {maxDevices > 1 ? 's' : ''} autorisé{maxDevices > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Devices list */}
      <DevicesList
        devices={devices || []}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount || 0}
        itemsPerPage={itemsPerPage}
      />
    </div>
  )
}
