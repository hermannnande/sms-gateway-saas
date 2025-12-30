'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campaign = {
  id: string
  name: string
  status: string
  created_at: string
  total_count?: number
  sent_count?: number
  campaign_jobs?: { status: string; created_at: string }[] | null
  templates: { name: string; body: string } | null
}

type Stats = {
  total: number
  queued: number
  sending: number
  sent: number
  failed: number
  skipped_optout: number
}

export function CampaignDetails({
  campaign: initialCampaign,
  stats: initialStats,
}: {
  campaign: Campaign
  stats: Stats
}) {
  const [campaign, setCampaign] = useState(initialCampaign)
  const [stats, setStats] = useState(initialStats)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<Action | null>(null)

  async function refreshStats() {
    setRefreshing(true)
    const supabase = createClient()

    const { data: messages } = await supabase
      .from('messages')
      .select('status')
      .eq('campaign_id', campaign.id)

    const newStats = {
      total: messages?.length || 0,
      queued: messages?.filter((m) => m.status === 'queued').length || 0,
      sending: messages?.filter((m) => m.status === 'sending').length || 0,
      sent: messages?.filter((m) => m.status === 'sent').length || 0,
      failed: messages?.filter((m) => m.status === 'failed').length || 0,
      skipped_optout: messages?.filter((m) => m.status === 'skipped_optout').length || 0,
    }

    setStats(newStats)

    // Refresh campaign status
    const { data: updatedCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign.id)
      .single()

    if (updatedCampaign) {
      setCampaign(updatedCampaign as any)
    }

    setRefreshing(false)
  }

  // Auto-refresh every 5 seconds if campaign is running
  useEffect(() => {
    if (campaign.status === 'running' || campaign.status === 'queued') {
      const interval = setInterval(refreshStats, 5000)
      return () => clearInterval(interval)
    }
  }, [campaign.status])

  const progressFromCounts =
    campaign.total_count && campaign.total_count > 0
      ? Math.round(((campaign.sent_count ?? 0) / campaign.total_count) * 100)
      : null
  const progress =
    progressFromCounts ?? (stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0)

  type Action = 'pause' | 'resume' | 'cancel'

  const onControl = async (action: Action) => {
    setActionLoading(action)
    const supabase = createClient()
    const { error } = await supabase.functions.invoke('campaign_control', {
      body: { action, campaign_id: campaign.id },
    })
    if (!error) {
      await refreshStats()
    }
    setActionLoading(null)
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">{campaign.name}</h1>
          <p className="text-muted-foreground">
            Template: {campaign.templates?.name || 'N/A'}
          </p>
          <p className="text-sm text-muted-foreground">
            {campaign.total_count ?? 0} messages prévus • {campaign.sent_count ?? 0} envoyés
          </p>
          {campaign.campaign_jobs && campaign.campaign_jobs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              File d'attente : {campaign.campaign_jobs.length} job(s) (statut dernier : {campaign.campaign_jobs[0].status})
            </p>
          )}
        </div>
        <button
          onClick={refreshStats}
          disabled={refreshing}
          className="px-4 py-2 border border-border rounded-lg hover:bg-accent disabled:opacity-50"
        >
          {refreshing ? '🔄 Actualisation...' : '🔄 Actualiser'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Progression</span>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-primary h-4 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 mb-1">En attente</p>
          <p className="text-2xl font-bold text-blue-600">{stats.queued}</p>
        </div>
        <div className="bg-card border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-600 mb-1">En cours</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.sending}</p>
        </div>
        <div className="bg-card border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 mb-1">Envoyés</p>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
        <div className="bg-card border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600 mb-1">Échecs</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </div>
        <div className="bg-card border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Optout</p>
          <p className="text-2xl font-bold text-gray-600">{stats.skipped_optout}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-8">
        {campaign.status === 'running' && (
          <button
            onClick={() => onControl('pause')}
            disabled={!!actionLoading}
            className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {actionLoading === 'pause' ? '…' : '⏸️ Pause'}
          </button>
        )}
        {campaign.status === 'paused' && (
          <button
            onClick={() => onControl('resume')}
            disabled={!!actionLoading}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {actionLoading === 'resume' ? '…' : '▶️ Reprendre'}
          </button>
        )}
        {(campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'queued') && (
          <button
            onClick={() => onControl('cancel')}
            disabled={!!actionLoading}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {actionLoading === 'cancel' ? '…' : '❌ Annuler'}
          </button>
        )}
        <a
          href="/dashboard/campaigns"
          className="px-6 py-2 border border-border rounded-lg hover:bg-accent"
        >
          ← Retour aux campagnes
        </a>
      </div>

      {/* Template preview */}
      {campaign.templates && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-2">Message template</h3>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {campaign.templates.body}
          </p>
        </div>
      )}
    </div>
  )
}




