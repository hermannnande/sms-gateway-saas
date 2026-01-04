'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'
import { createClient } from '@/lib/supabase/client'

interface Event {
  id: string
  event_type: string
  metadata: any
  occurred_at: string
  user_id: string | null
  device_id: string | null
}

export default function AdminTrafficPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  useEffect(() => {
    loadEvents()
  }, [currentPage, typeFilter])

  async function loadEvents() {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('analytics_events')
      .select('*', { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

    if (typeFilter !== 'all') {
      query = query.eq('event_type', typeFilter)
    }

    const { data, count, error } = await query

    if (!error && data) {
      setEvents(data)
      setTotalCount(count || 0)
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
        if (!row.metadata) return '-'
        const meta = row.metadata
        if (meta.source) return `Source: ${meta.source}`
        if (meta.user_agent) return `UA: ${meta.user_agent.substring(0, 40)}...`
        if (meta.device_token) return `Device: ${meta.device_token.substring(0, 12)}...`
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
