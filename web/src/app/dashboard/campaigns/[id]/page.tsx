import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignDetails } from './campaign-details'
import { CampaignImportFileCard } from './campaign-import-file'

export default async function CampaignPage({ params }: { params: { id: string } }) {
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
    .eq('id', params.id)
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
  let smsQuotaMonth: number | null = activeSub?.plans?.sms_quota_month ?? 100
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
  const { data: messages } = await supabase
    .from('messages')
    .select('status')
    .eq('campaign_id', params.id)

  // Fichier de contacts archivé lors de la création. L'erreur éventuelle est
  // ignorée : tant que la migration campaign_import_files n'est pas appliquée,
  // la page doit continuer à s'afficher normalement.
  const { data: importFile } = await supabase
    .from('campaign_import_files')
    .select(
      'id, campaign_id, campaign_name, file_name, storage_path, mime_type, size_bytes, contact_count, invalid_count, created_at',
    )
    .eq('campaign_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const stats = {
    total: messages?.length || 0,
    queued: messages?.filter((m) => m.status === 'queued').length || 0,
    sending: messages?.filter((m) => m.status === 'sending').length || 0,
    sent: messages?.filter((m) => m.status === 'sent').length || 0,
    failed: messages?.filter((m) => m.status === 'failed').length || 0,
    skipped_optout: messages?.filter((m) => m.status === 'skipped_optout').length || 0,
  }

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
        <CampaignImportFileCard file={importFile ?? null} />
      </main>
    </div>
  )
}




