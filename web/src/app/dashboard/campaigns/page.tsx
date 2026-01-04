import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignsList } from './campaigns-list'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

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
      'id, name, status, created_at, total_count, sent_count, sim_slot_index, templates(name), campaign_jobs(status, created_at)'
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

    // Récupérer les messages de toutes les campagnes
    const { data: allMessages } = await supabase
      .from('messages')
      .select('status')
      .eq('org_id', orgMember.org_id)

    if (allMessages) {
      stats.totalMessages = allMessages.length
      stats.totalSent = allMessages.filter((m) => m.status === 'sent').length
      stats.totalDelivered = allMessages.filter((m) => m.status === 'delivered').length
      stats.totalFailed = allMessages.filter((m) => m.status === 'failed').length
      stats.successRate =
        stats.totalMessages > 0
          ? Math.round((stats.totalDelivered / stats.totalMessages) * 100)
          : 0
    }
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
          value={stats.totalMessages}
          icon={<>📨</>}
        />
        <StatCard
          title="Taux de succès"
          value={`${stats.successRate}%`}
          icon={<>✅</>}
        />
        <StatCard title="Échecs" value={stats.totalFailed} icon={<>❌</>} />
      </div>

      {/* Campaigns list */}
      <CampaignsList
        campaigns={campaigns || []}
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
