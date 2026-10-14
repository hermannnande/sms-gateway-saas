import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignsList } from './campaigns-list'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { campaignStats } from '@/lib/campaign-stats'

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const currentPage = parseInt(params.page || '1', 10)
  const itemsPerPage = 15
  const statusFilter = params.status || 'all'
  const searchQuery = params.q || ''

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's org_id
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!orgMember) {
    return <div>Aucune organisation trouvée</div>
  }

  // Quota SMS (mois en cours) - utile pour expliquer pourquoi des messages restent "en attente"
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('plans(sms_quota_month)')
    .eq('org_id', orgMember.org_id)
    .eq('status', 'active')
    .eq('plans.is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let smsQuotaMonth: number | null = (activeSub?.plans as unknown as { sms_quota_month?: number } | null)?.sms_quota_month ?? 100
  if (smsQuotaMonth === 0) smsQuotaMonth = null
  const { count: usedCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgMember.org_id)
    .eq('status', 'sent')
    .gte('sent_at', monthStart)
  const smsUsedThisMonth = usedCount || 0
  const smsRemaining = smsQuotaMonth === null ? null : Math.max(smsQuotaMonth - smsUsedThisMonth, 0)

  // Build query for total count
  let countQuery = supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgMember.org_id)

  if (statusFilter !== 'all') {
    countQuery = countQuery.eq('status', statusFilter)
  }
  if (searchQuery) {
    countQuery = countQuery.ilike('name', `%${searchQuery}%`)
  }

  const { count: totalCount } = await countQuery

  // Build query for paginated campaigns
  const from = (currentPage - 1) * itemsPerPage
  const to = from + itemsPerPage - 1

  let campaignsQuery = supabase
    .from('campaigns')
    .select(
      'id, name, status, created_at, total_count, sent_count, sim_slot_index, priority, device_id, devices(name), templates(name), campaign_jobs(status, created_at)'
    )
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (statusFilter !== 'all') {
    campaignsQuery = campaignsQuery.eq('status', statusFilter)
  }
  if (searchQuery) {
    campaignsQuery = campaignsQuery.ilike('name', `%${searchQuery}%`)
  }

  const { data: campaigns } = await campaignsQuery
  const deliveryStats = await campaignStats(supabase, (campaigns ?? []).map(c => c.id))
  const statsById = new Map(deliveryStats.map(s => [s.campaign_id, s]))
  const campaignsWithDelivery = (campaigns ?? []).map(c => ({ ...c,
    devices: (c.devices as unknown as { name: string } | null),
    templates: (c.templates as unknown as { name: string } | null),
    sent_count: statsById.get(c.id)?.sent ?? c.sent_count,
    total_count: statsById.get(c.id)?.total ?? c.total_count,
    delivered_count: statsById.get(c.id)?.delivered ?? 0,
  }))

  // Calculer les statistiques globales
  const stats = {
    totalCampaigns: 0,
    totalMessages: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    successRate: 0,
  }

  if (orgMember) {
    // Count all campaigns
    const { count } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)
    stats.totalCampaigns = count || 0

    const [sent, delivered, failed] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('org_id', orgMember.org_id).eq('status', 'sent'),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('org_id', orgMember.org_id).eq('status', 'sent').eq('delivery_status', 'delivered'),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('org_id', orgMember.org_id).eq('status', 'failed'),
    ])
    if (sent.error || delivered.error || failed.error) throw new Error('Statistiques indisponibles')
    stats.totalSent = sent.count ?? 0
    stats.totalDelivered = delivered.count ?? 0
    stats.totalFailed = failed.count ?? 0
    stats.successRate = stats.totalSent ? Math.round(stats.totalDelivered / stats.totalSent * 100) : 0
  }

  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campagnes SMS"
        description="Gérez et analysez vos campagnes d'envoi de messages"
        icon={<>🚀</>}
        actions={
          <a
            href="/dashboard/campaigns/new"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition shadow-sm hover:shadow-md"
          >
            <span className="text-xl">➕</span>
            Nouvelle campagne
          </a>
        }
      />

      <div className="glass-card rounded-2xl p-4 border-2 border-black/10 dark:border-white/10 bg-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-bold">Quota SMS (mois en cours)</div>
            <div className="text-sm text-muted-foreground">
              {smsRemaining === null
                ? `${smsUsedThisMonth} SMS envoyés (illimité)`
                : `${smsUsedThisMonth}/${smsQuotaMonth} • reste ${smsRemaining}`}
            </div>
            {smsRemaining === 0 && (
              <div className="text-sm text-red-700 dark:text-red-400 mt-1 font-semibold">
                🚫 Quota atteint : les messages restants resteront en attente jusqu’au renouvellement ou upgrade.
              </div>
            )}
          </div>
          <a
            href="/billing/plans"
            className="px-4 py-2 text-xs bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition whitespace-nowrap"
          >
            Voir les plans
          </a>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total campagnes"
          value={stats.totalCampaigns}
          icon={<>🚀</>}
          href="/dashboard/campaigns"
        />
        <StatCard
          title="Messages envoyés"
          value={stats.totalSent}
          icon={<>📨</>}
        />
        <StatCard
          title="Taux de réception"
          value={`${stats.successRate}%`}
          icon={<>✅</>}
        />
        <StatCard title="Échecs" value={stats.totalFailed} icon={<>❌</>} />
      </div>

      {/* Campaigns list */}
      <CampaignsList
        campaigns={campaignsWithDelivery}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount || 0}
        itemsPerPage={itemsPerPage}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />
    </div>
  )
}
