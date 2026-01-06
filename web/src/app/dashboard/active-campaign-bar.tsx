'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ActiveCampaign = {
  id: string
  name: string
  status: string
  sent_count: number | null
  total_count: number | null
  updated_at?: string
}

export function ActiveCampaignBar({
  orgId,
  initialCampaign,
}: {
  orgId: string
  initialCampaign: ActiveCampaign | null
}) {
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(initialCampaign)
  const [loadingAction, setLoadingAction] = useState<'pause' | 'resume' | 'cancel' | null>(null)

  const progress = useMemo(() => {
    if (!campaign) return 0
    const sent = campaign.sent_count ?? 0
    const total = campaign.total_count ?? 0
    if (!total) return 0
    return Math.max(0, Math.min(1, sent / total))
  }, [campaign])

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase
      .from('campaigns')
      .select('id,name,status,sent_count,total_count,updated_at')
      .eq('org_id', orgId)
      .in('status', ['running', 'paused', 'queued'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCampaign((data as any) || null)
  }

  async function onControl(action: 'pause' | 'resume' | 'cancel') {
    if (!campaign) return
    setLoadingAction(action)
    try {
      const supabase = createClient()
      const { error } = await supabase.functions.invoke('campaign_control', {
        body: { action, campaign_id: campaign.id },
      })
      if (error) throw error
      await refresh()
    } finally {
      setLoadingAction(null)
    }
  }

  useEffect(() => {
    // Auto refresh toutes les 3s si campagne running
    if (!campaign || campaign.status !== 'running') return
    const t = setInterval(() => {
      refresh()
    }, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, campaign?.status])

  if (!campaign) return null

  const sent = campaign.sent_count ?? 0
  const total = campaign.total_count ?? 0
  const remain = Math.max(0, total - sent)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📤</span>
            <p className="font-bold truncate">{campaign.name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {sent}/{total} envoyés • reste {remain}
          </p>
          <div className="mt-2 h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-3 bg-primary transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {campaign.status === 'running' && (
            <button
              onClick={() => onControl('pause')}
              disabled={!!loadingAction}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:opacity-90 disabled:opacity-60 text-sm font-semibold"
            >
              {loadingAction === 'pause' ? '…' : '⏸️ Pause'}
            </button>
          )}
          {(campaign.status === 'paused' || campaign.status === 'queued') && (
            <button
              onClick={() => onControl('resume')}
              disabled={!!loadingAction}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 disabled:opacity-60 text-sm font-semibold"
            >
              {loadingAction === 'resume' ? '…' : '▶️ Reprendre'}
            </button>
          )}
          {(campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'queued') && (
            <button
              onClick={() => onControl('cancel')}
              disabled={!!loadingAction}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:opacity-90 disabled:opacity-60 text-sm font-semibold"
            >
              {loadingAction === 'cancel' ? '…' : '❌ Annuler'}
            </button>
          )}
          <a
            href={`/dashboard/campaigns/${campaign.id}`}
            className="px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm font-semibold"
          >
            Voir
          </a>
        </div>
      </div>
    </div>
  )
}


