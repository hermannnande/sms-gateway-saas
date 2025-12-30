import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignsList } from './campaigns-list'

export default async function CampaignsPage() {
  const supabase = await createClient()

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

  // Get campaigns with stats + jobs (file d'attente)
  const { data: campaigns } = orgMember ? await supabase
    .from('campaigns')
    .select('id, name, status, created_at, total_count, sent_count, templates(name), campaign_jobs(status, created_at)')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false }) : { data: [] }

  // Calculer les statistiques globales
  const stats = {
    totalCampaigns: 0,
    totalMessages: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    successRate: 0
  }

  if (orgMember && campaigns && campaigns.length > 0) {
    stats.totalCampaigns = campaigns.length

    // Récupérer les messages de toutes les campagnes
    const { data: allMessages } = await supabase
      .from('messages')
      .select('status')
      .eq('org_id', orgMember.org_id)

    if (allMessages) {
      stats.totalMessages = allMessages.length
      stats.totalSent = allMessages.filter(m => m.status === 'sent').length
      stats.totalDelivered = allMessages.filter(m => m.status === 'delivered').length
      stats.totalFailed = allMessages.filter(m => m.status === 'failed').length
      stats.successRate = stats.totalMessages > 0 
        ? Math.round((stats.totalDelivered / stats.totalMessages) * 100) 
        : 0
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Campagnes SMS
          </h1>
          <p className="text-muted-foreground">
            Gérez et analysez vos campagnes d&apos;envoi de messages
          </p>
        </div>
        <a
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-sm hover:shadow-md"
        >
          <span className="text-xl">➕</span>
          Nouvelle campagne
        </a>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total campagnes</p>
          <p className="text-3xl font-bold text-primary">{stats.totalCampaigns}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Messages envoyés</p>
          <p className="text-3xl font-bold text-foreground">{stats.totalMessages}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Taux de succès</p>
          <p className="text-3xl font-bold text-green-600">{stats.successRate}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Échecs</p>
          <p className="text-3xl font-bold text-red-600">{stats.totalFailed}</p>
        </div>
      </div>

      {/* Campaigns list */}
      <CampaignsList campaigns={campaigns || []} />
    </div>
  )
}
