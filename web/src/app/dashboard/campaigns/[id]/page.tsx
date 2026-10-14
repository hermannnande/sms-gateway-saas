import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignDetails } from './campaign-details'
import { CampaignImportFileCard } from './campaign-import-file'
import { campaignStats } from '@/lib/campaign-stats'

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, templates(name, body), campaign_jobs(status, created_at), devices(name)')
    .eq('id', id)
    .single()

  if (!campaign) {
    redirect('/dashboard/campaigns')
  }

  // Quota SMS (mois en cours) pour afficher une alerte claire si des messages restent en attente
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('plans(sms_quota_month)')
    .eq('org_id', campaign.org_id)
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
    .eq('org_id', campaign.org_id)
    .eq('status', 'sent')
    .gte('sent_at', monthStart)
  const smsUsedThisMonth = usedCount || 0
  const smsRemaining = smsQuotaMonth === null ? null : Math.max(smsQuotaMonth - smsUsedThisMonth, 0)

  // Get messages stats
  const [stats] = await campaignStats(supabase, [id])
  if (!stats) redirect('/dashboard/campaigns')

  // Fichier de contacts archivé lors de la création. L'erreur éventuelle est
  // ignorée : tant que la migration campaign_import_files n'est pas appliquée,
  // la page doit continuer à s'afficher normalement.
  const { data: importFiles } = await supabase
    .from('campaign_import_files')
    .select(
      'id, campaign_id, campaign_name, file_name, storage_path, mime_type, size_bytes, contact_count, invalid_count, created_at',
    )
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <a href="/dashboard" className="text-xl font-bold text-primary">
            SMSenvoie
          </a>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <CampaignDetails
          campaign={campaign}
          stats={stats}
          quotaInfo={{ quota: smsQuotaMonth, used: smsUsedThisMonth, remaining: smsRemaining }}
        />
        {importFiles?.length ? importFiles.map((file) => (
          <CampaignImportFileCard key={file.id} file={file} campaignId={id} />
        )) : <CampaignImportFileCard file={null} campaignId={id} />}
      </main>
    </div>
  )
}




