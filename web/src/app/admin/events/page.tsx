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

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 100

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

  const columns = [
    {
      header: 'ID',
      accessor: (row: Event) => row.id.substring(0, 8) + '...',
      className: 'font-mono text-xs',
    },
    {
      header: 'Type',
      accessor: 'event_type' as keyof Event,
      className: 'font-medium',
    },
    {
      header: 'Date/Heure',
      accessor: (row: Event) => {
        const date = new Date(row.occurred_at)
        return date.toLocaleString('fr-FR')
      },
    },
    {
      header: 'Metadata',
      accessor: (row: Event) => (
        <pre className="text-xs text-gray-600 max-w-xs overflow-x-auto">
          {JSON.stringify(row.metadata, null, 2)}
        </pre>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Événements (Logs)"
        description={`${totalCount} événements • Dernières 48h`}
      />

      <Filters
        filters={[
          {
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { label: 'Tous', value: 'all' },
              { label: 'APK Downloads', value: 'apk_download' },
              { label: 'Web Ping', value: 'web_ping' },
              { label: 'Device Heartbeat', value: 'device_heartbeat' },
              { label: 'Device Claim', value: 'device_claim' },
              { label: 'Device Update Status', value: 'device_update_status' },
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
