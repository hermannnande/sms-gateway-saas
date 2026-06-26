'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'

type Campaign = {
  id: string
  name: string
  status: string
  created_at: string
  total_count?: number
  sent_count?: number
  sim_slot_index?: number | null
  device_id?: string | null
  devices?: { name: string } | null
  priority?: number
  campaign_jobs?: { status: string; created_at: string }[] | null
  templates: { name: string } | null
}

type CampaignsListProps = {
  campaigns: Campaign[]
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  statusFilter: string
  searchQuery: string
}

export function CampaignsList({
  campaigns,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  statusFilter,
  searchQuery,
}: CampaignsListProps) {
  const router = useRouter()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [localStatus, setLocalStatus] = useState(statusFilter)

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    if (localStatus !== 'all') params.set('status', localStatus)
    if (localSearch) params.set('q', localSearch)
    router.push(`/dashboard/campaigns?${params.toString()}`)
  }

  const handleSearch = () => {
    const params = new URLSearchParams()
    params.set('page', '1') // Reset to page 1 on search
    if (localStatus !== 'all') params.set('status', localStatus)
    if (localSearch) params.set('q', localSearch)
    router.push(`/dashboard/campaigns?${params.toString()}`)
  }

  const handleStatusChange = (newStatus: string) => {
    setLocalStatus(newStatus)
    const params = new URLSearchParams()
    params.set('page', '1') // Reset to page 1 on filter
    if (newStatus !== 'all') params.set('status', newStatus)
    if (localSearch) params.set('q', localSearch)
    router.push(`/dashboard/campaigns?${params.toString()}`)
  }

  if (totalItems === 0 && !searchQuery && statusFilter === 'all') {
    return (
      <div className="bg-card rounded-lg p-16 text-center border border-border shadow-sm">
        <div className="text-7xl mb-6">🚀</div>
        <h3 className="text-2xl font-bold mb-3">Aucune campagne</h3>
        <p className="text-muted-foreground mb-8 text-lg">
          Créez votre première campagne SMS pour commencer
        </p>
        <a
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-medium text-lg shadow-sm hover:shadow-md hover:bg-primary/90 transition-all"
        >
          Créer ma première campagne
        </a>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: string }> = {
      draft: {
        color: 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700',
        label: 'Brouillon',
        icon: '📝',
      },
      queued: {
        color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
        label: 'En file',
        icon: '⏳',
      },
      running: {
        color: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
        label: 'En cours',
        icon: '▶️',
      },
      paused: {
        color: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
        label: 'Pause',
        icon: '⏸️',
      },
      done: {
        color: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
        label: 'Terminée',
        icon: '✅',
      },
      canceled: {
        color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
        label: 'Annulée',
        icon: '❌',
      },
    }

    const badge = badges[status] || badges.draft

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${badge.color}`}
      >
        <span>{badge.icon}</span>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={localSearch}
                onChange={setLocalSearch}
                placeholder="Rechercher une campagne…"
              />
            </div>
            <select
              value={localStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="queued">En file</option>
              <option value="running">En cours</option>
              <option value="paused">Pause</option>
              <option value="done">Terminée</option>
              <option value="canceled">Annulée</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-all"
            >
              Rechercher
            </button>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{totalItems}</span> résultat(s)
          </div>
        </div>
      </div>

      {/* Liste */}
      {campaigns.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center border border-border">
          <div className="text-5xl mb-4 opacity-30">🔍</div>
          <p className="text-muted-foreground">
            Aucune campagne ne correspond à vos critères
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <a
              key={campaign.id}
              href={`/dashboard/campaigns/${campaign.id}`}
              className="block bg-card rounded-lg p-5 border border-border hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition truncate">
                    {campaign.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span>📝</span>
                      <span className="font-medium">
                        {campaign.templates?.name || 'N/A'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span>📅</span>
                      <span>
                        {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </span>
                    {(campaign.total_count || campaign.sent_count) && (
                      <span className="flex items-center gap-1.5">
                        <span>📊</span>
                        <span>
                          {campaign.sent_count ?? 0}/{campaign.total_count ?? '?'} envoyés
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span>📱</span>
                      <span>
                        {campaign.devices?.name || (campaign.device_id ? 'Appareil assigné' : 'Tout appareil')}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span>📲</span>
                      <span>
                        {campaign.sim_slot_index === null ||
                        campaign.sim_slot_index === undefined
                          ? 'SIM Auto'
                          : campaign.sim_slot_index === 0
                          ? 'SIM 1'
                          : 'SIM 2'}
                      </span>
                    </span>
                    {(campaign.priority ?? 0) > 0 && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${
                        campaign.priority === 2
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      }`}>
                        {campaign.priority === 2 ? '🔴 Urgente' : '🟡 Haute'}
                      </span>
                    )}
                    {campaign.campaign_jobs && campaign.campaign_jobs.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span>🗂️</span>
                        <span>{campaign.campaign_jobs.length} job(s)</span>
                      </span>
                    )}
                  </div>
                </div>
                {getStatusBadge(campaign.status)}
              </div>
              <div className="flex items-center text-primary text-sm font-medium group-hover:translate-x-2 transition-transform">
                Voir les détails →
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}
