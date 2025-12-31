import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DevicesList } from './devices-list'
import { AddDeviceButton } from './add-device-button'

export const dynamic = 'force-dynamic'

export default async function DevicesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's org_id
  const { data: orgMembers } = await supabase
    .from('org_members')
    .select('org_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  let orgIds = (orgMembers ?? []).map((m) => m.org_id)

  // Auto-heal: if user has no org, create one so devices can be attached & visible
  if (orgIds.length === 0) {
    const orgId = crypto.randomUUID()
    await supabase.from('organizations').insert({ id: orgId, name: 'Mon organisation' })
    await supabase.from('org_members').insert({ org_id: orgId, user_id: user.id, role: 'ORG_ADMIN' })
    orgIds = [orgId]
  }

  // Get devices
  const { data: devices } =
    orgIds.length > 0
      ? await supabase.from('devices').select('*').in('org_id', orgIds).order('created_at', { ascending: false })
      : { data: [] }

  // Get subscription (for max_devices check)
  const { data: subscription } = orgIds.length > 0 ? await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('org_id', orgIds[0])
    .eq('status', 'active')
    .single() : { data: null }

  const maxDevices = subscription?.plans?.max_devices || 10
  const canAddDevice = (devices?.length || 0) < maxDevices

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Appareils Gateway
          </h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{devices?.length || 0}</span> / <span className="font-semibold">{maxDevices}</span> appareil{maxDevices > 1 ? 's' : ''} connecté{(devices?.length || 0) > 1 ? 's' : ''}
          </p>
        </div>
        <AddDeviceButton canAdd={canAddDevice} />
      </div>

      {/* Subscription info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
        <div className="text-4xl">ℹ️</div>
        <div>
          {subscription ? (
            <p className="text-sm text-blue-800">
              Plan <span className="font-bold">{subscription.plans?.name}</span> : jusqu'à <span className="font-bold">{maxDevices}</span> appareil{maxDevices > 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-sm text-blue-800">
              Mode développement : <span className="font-bold">{maxDevices}</span> appareil{maxDevices > 1 ? 's' : ''} autorisé{maxDevices > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Devices list */}
      <DevicesList devices={devices || []} />
    </div>
  )
}
