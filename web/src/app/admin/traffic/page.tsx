'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'

interface Event {
  id: string
  event_type: string
  meta: any
  occurred_at: string
  user_id: string | null
  device_id: string | null
}

export default function AdminTrafficPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  useEffect(() => {
    loadEvents()
  }, [currentPage, typeFilter])

  async function loadEvents() {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      type: typeFilter,
      page: String(currentPage - 1),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/admin/events?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (json?.ok) {
      setEvents(json.items || [])
      setTotalCount(json.total || 0)
    } else {
      setEvents([])
      setTotalCount(0)
      setError(json?.error || `Erreur API (${res.status})`)
    }
    setLoading(false)
  }

  const eventTypeLabels: Record<string, string> = {
    apk_download: '📥 Téléchargement APK',
    web_ping: '🌐 Activité Web',
    device_heartbeat: '💓 Heartbeat Appareil',
    device_claim: '📨 Claim Messages',
    device_update_status: '✅ Update Status',
  }

  const columns = [
    {
      header: 'Type',
      accessor: (row: Event) => (
        <span className="inline-flex items-center gap-2">
          {eventTypeLabels[row.event_type] || row.event_type}
        </span>
      ),
    },
    {
      header: 'Date/Heure',
      accessor: (row: Event) => {
        const date = new Date(row.occurred_at)
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString('fr-FR')}</div>
            <div className="text-gray-500">{date.toLocaleTimeString('fr-FR')}</div>
          </div>
        )
      },
    },
    {
      header: 'Détails',
      accessor: (row: Event) => {
        if (!row.meta) return '-'
        const meta = row.meta
        if (meta.source) return `Source: ${meta.source}`
        if (meta.user_agent) return `UA: ${meta.user_agent.substring(0, 40)}...`
        if (meta.token_hash) return `Device: ${String(meta.token_hash).substring(0, 12)}...`
        return JSON.stringify(meta).substring(0, 50)
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Trafic & Activité" description={`${totalCount} événements enregistrés`} />

      <Filters
        filters={[
          {
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { label: 'Tous', value: 'all' },
              { label: '📥 Téléchargements APK', value: 'apk_download' },
              { label: '🌐 Activité Web', value: 'web_ping' },
              { label: '💓 Heartbeats', value: 'device_heartbeat' },
              { label: '📨 Claims', value: 'device_claim' },
              { label: '✅ Updates', value: 'device_update_status' },
            ],
          },
        ]}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      <AdminTable data={events} columns={columns} loading={loading} emptyMessage="Aucun événement trouvé" />

      {totalCount > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalCount / pageSize)}
          onPageChange={setCurrentPage}
          itemsPerPage={pageSize}
          totalItems={totalCount}
        />
      )}
    </div>
  )
}
