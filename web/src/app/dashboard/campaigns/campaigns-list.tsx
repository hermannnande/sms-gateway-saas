'use client'

import { useMemo, useState } from 'react'

type Campaign = {
  id: string
  name: string
  status: string
  created_at: string
  total_count?: number
  sent_count?: number
  campaign_jobs?: { status: string; created_at: string }[] | null
  templates: { name: string } | null
}

export function CampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | Campaign['status']>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return campaigns.filter((c) => {
      const matchQuery = !q || c.name.toLowerCase().includes(q)
      const matchStatus = status === 'all' || c.status === status
      return matchQuery && matchStatus
    })
  }, [campaigns, query, status])

  if (campaigns.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-16 text-center border-4 border-black/10 dark:border-white/10 animate-fade-in">
        <div className="text-7xl mb-6 animate-float">🚀</div>
        <h3 className="text-2xl font-black mb-3">Aucune campagne</h3>
        <p className="text-muted-foreground mb-8 text-lg">
          Créez votre première campagne SMS pour commencer
        </p>
        <a
          href="/dashboard/campaigns/new"
          className="inline-block px-8 py-4 bg-gradient-primary text-white rounded-xl font-bold text-lg shadow-brutal-primary border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200"
        >
          Créer ma première campagne
        </a>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: string }> = {
      draft: { color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30', label: 'Brouillon', icon: '📝' },
      queued: { color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30', label: 'En file', icon: '⏳' },
      running: { color: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30', label: 'En cours', icon: '▶️' },
      paused: { color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30', label: 'Pause', icon: '⏸️' },
      done: { color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30', label: 'Terminée', icon: '✅' },
      canceled: { color: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30', label: 'Annulée', icon: '❌' },
    }

    const badge = badges[status] || badges.draft

    return (
      <span className={`px-3 py-1.5 rounded-xl text-sm font-bold border-2 ${badge.color} flex items-center gap-1.5`}>
        <span>{badge.icon}</span>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="glass-card rounded-2xl p-4 border-4 border-black/10 dark:border-white/10">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une campagne…"
              className="w-full sm:w-[320px] px-4 py-2.5 rounded-xl border-2 border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 outline-none focus:ring-2 focus:ring-primary/40"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full sm:w-[220px] px-4 py-2.5 rounded-xl border-2 border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="queued">En file</option>
              <option value="running">En cours</option>
              <option value="paused">Pause</option>
              <option value="done">Terminée</option>
              <option value="canceled">Annulée</option>
            </select>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> résultat(s)
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="grid gap-4">
      {filtered.map((campaign) => (
        <a
          key={campaign.id}
          href={`/dashboard/campaigns/${campaign.id}`}
          className="glass-card rounded-2xl p-6 border-4 border-black/10 dark:border-white/10 hover-lift group animate-fade-in"
        >
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
            <div className="flex-1">
              <h3 className="font-black text-xl mb-2 group-hover:text-primary transition">
                {campaign.name}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">📝</span>
                  <span className="font-semibold">{campaign.templates?.name || 'N/A'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">📅</span>
                  <span>{new Date(campaign.created_at).toLocaleDateString('fr-FR')}</span>
                </span>
                {(campaign.total_count || campaign.sent_count) && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-lg">📊</span>
                    <span>
                      {campaign.sent_count ?? 0}/{campaign.total_count ?? '?'} envoyés
                    </span>
                  </span>
                )}
                {campaign.campaign_jobs && campaign.campaign_jobs.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-lg">🗂️</span>
                    <span>{campaign.campaign_jobs.length} job(s)</span>
                  </span>
                )}
              </div>
            </div>
            {getStatusBadge(campaign.status)}
          </div>
          <div className="flex items-center text-primary font-semibold group-hover:translate-x-2 transition-transform">
            Voir les détails →
          </div>
        </a>
      ))}
      </div>
    </div>
  )
}


