'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campaign = {
  id: string
  name: string
  status: string
  created_at: string
  total_count?: number
  sent_count?: number
  sim_slot_index?: number | null
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

type MessageRow = {
  id: string
  to_phone_e164: string
  status: string
  try_count: number
  last_error: string | null
  sim_subscription_id: string | null
  created_at: string
  sent_at: string | null
}

export function CampaignDetails({
  campaign: initialCampaign,
  stats: initialStats,
  quotaInfo,
}: {
  campaign: Campaign
  stats: Stats
  quotaInfo: { quota: number | null; used: number; remaining: number | null }
}) {
  const [campaign, setCampaign] = useState(initialCampaign)
  const [stats, setStats] = useState(initialStats)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<Action | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [msgStatus, setMsgStatus] = useState<'all' | string>('all')
  const [msgQuery, setMsgQuery] = useState('')

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

  async function fetchMessages() {
    setMessagesLoading(true)
    try {
      const supabase = createClient()
      let q = supabase
        .from('messages')
        .select('id,to_phone_e164,status,try_count,last_error,sim_subscription_id,created_at,sent_at')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (msgStatus !== 'all') {
        q = q.eq('status', msgStatus)
      }
      const mq = msgQuery.trim()
      if (mq) {
        q = q.ilike('to_phone_e164', `%${mq}%`)
      }

      const { data } = await q
      setMessages((data ?? []) as any)
    } finally {
      setMessagesLoading(false)
    }
  }

  // Auto-refresh every 5 seconds if campaign is running
  useEffect(() => {
    if (campaign.status === 'running' || campaign.status === 'queued') {
      const interval = setInterval(refreshStats, 5000)
      return () => clearInterval(interval)
    }
  }, [campaign.status])

  useEffect(() => {
    fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id])

  useEffect(() => {
    fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgStatus, msgQuery])

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
      await fetchMessages()
    }
    setActionLoading(null)
  }

  const statusBadge = useMemo(() => {
    const badges: Record<string, { label: string; cls: string; icon: string }> = {
      draft: { label: 'Brouillon', cls: 'bg-gray-500/10 text-gray-700 border-gray-500/30', icon: '📝' },
      queued: { label: 'En file', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30', icon: '⏳' },
      running: { label: 'En cours', cls: 'bg-green-500/10 text-green-700 border-green-500/30', icon: '▶️' },
      paused: { label: 'Pause', cls: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: '⏸️' },
      done: { label: 'Terminée', cls: 'bg-purple-500/10 text-purple-700 border-purple-500/30', icon: '✅' },
      canceled: { label: 'Annulée', cls: 'bg-red-500/10 text-red-700 border-red-500/30', icon: '❌' },
    }
    return badges[campaign.status] ?? badges.draft
  }, [campaign.status])

  return (
    <div>
      {quotaInfo.remaining === 0 && (stats.queued > 0 || stats.sending > 0) && (
        <div className="mb-6 glass-card rounded-2xl p-4 border-2 border-red-500/20 bg-red-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2">
              <span className="text-2xl">🚫</span>
              <div>
                <div className="font-bold text-red-700 dark:text-red-400">Quota atteint</div>
                <div className="text-sm text-muted-foreground">
                  {stats.queued + stats.sending} message(s) restent en attente. Ils seront envoyés après renouvellement ou après upgrade.
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Quota ce mois : {quotaInfo.used}/{quotaInfo.quota ?? '∞'} • reste {quotaInfo.remaining ?? '∞'}
                </div>
              </div>
            </div>
            <a
              href="/billing/plans"
              className="px-4 py-2 text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg font-bold hover:bg-red-500/20 transition whitespace-nowrap"
            >
              Upgrade
            </a>
          </div>
        </div>
      )}

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">{campaign.name}</h1>
          <p className="text-muted-foreground">
            Template: {campaign.templates?.name || 'N/A'}
          </p>
          <p className="text-sm text-muted-foreground">
            {campaign.total_count ?? 0} messages prévus • {campaign.sent_count ?? 0} envoyés
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            SIM: <span className="font-semibold text-foreground">
              {campaign.sim_slot_index === null || campaign.sim_slot_index === undefined
                ? 'Auto'
                : campaign.sim_slot_index === 0
                  ? 'SIM 1'
                  : 'SIM 2'}
            </span>
          </p>
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 text-sm font-bold ${statusBadge.cls}`}
            >
              <span>{statusBadge.icon}</span>
              {statusBadge.label}
            </span>
          </div>
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
        {campaign.status === 'queued' && (
          <button
            onClick={() => onControl('resume')}
            disabled={!!actionLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {actionLoading === 'resume' ? '…' : '▶️ Démarrer'}
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

      {/* Messages */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h3 className="font-semibold">Messages (50 derniers)</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              value={msgQuery}
              onChange={(e) => setMsgQuery(e.target.value)}
              placeholder="Filtrer par numéro (+225...)"
              className="w-full sm:w-[260px] px-4 py-2.5 rounded-xl border-2 border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 outline-none focus:ring-2 focus:ring-primary/40"
            />
            <select
              value={msgStatus}
              onChange={(e) => setMsgStatus(e.target.value)}
              className="w-full sm:w-[200px] px-4 py-2.5 rounded-xl border-2 border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">Tous</option>
              <option value="queued">queued</option>
              <option value="sending">sending</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
              <option value="skipped_optout">skipped_optout</option>
            </select>
            <button
              onClick={fetchMessages}
              className="px-4 py-2.5 rounded-xl border-2 border-black/10 dark:border-white/10 hover:bg-accent"
              disabled={messagesLoading}
            >
              {messagesLoading ? 'Chargement…' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Destinataire</th>
                  <th className="text-left px-4 py-3 font-semibold">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold">Tentatives</th>
                  <th className="text-left px-4 py-3 font-semibold">SIM</th>
                  <th className="text-left px-4 py-3 font-semibold">Erreur</th>
                  <th className="text-left px-4 py-3 font-semibold">Créé</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                      {messagesLoading ? 'Chargement…' : 'Aucun message (ou filtres trop stricts).'}
                    </td>
                  </tr>
                ) : (
                  messages.map((m) => (
                    <tr key={m.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="px-4 py-3 font-semibold">{m.to_phone_e164}</td>
                      <td className="px-4 py-3">{m.status}</td>
                      <td className="px-4 py-3">{m.try_count ?? 0}</td>
                      <td className="px-4 py-3">{m.sim_subscription_id ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.last_error ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(m.created_at).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          La SIM est remplie quand le téléphone “claim” les messages (champ <code>sim_subscription_id</code>).
        </p>
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




