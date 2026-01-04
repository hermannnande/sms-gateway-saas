'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'

interface Subscription {
  id: string
  org_id: string
  status: string
  current_period_end: string | null
  created_at: string
  org_name: string
  plan_name: string | null
  price_xof: number | null
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadSubscriptions()
  }, [currentPage, statusFilter])

  async function loadSubscriptions() {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      status: statusFilter,
      page: String(currentPage - 1),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/admin/subscriptions?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (json?.ok) {
      setSubscriptions(json.items || [])
      setTotalCount(json.total || 0)
    } else {
      setSubscriptions([])
      setTotalCount(0)
      setError(json?.error || `Erreur API (${res.status})`)
    }
    setLoading(false)
  }

  const columns = [
    {
      header: 'Organisation',
      accessor: (row: Subscription) => row.org_name || '-',
    },
    {
      header: 'Plan',
      accessor: (row: Subscription) => row.plan_name || '-',
    },
    {
      header: 'Prix',
      accessor: (row: Subscription) =>
        (row.price_xof ?? 0) === 0 ? 'Gratuit' : `${(row.price_xof ?? 0).toLocaleString()} F CFA`,
    },
    {
      header: 'Statut',
      accessor: (row: Subscription) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.status === 'active'
              ? 'bg-green-100 text-green-800'
              : row.status === 'canceled'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: 'Fin de période',
      accessor: (row: Subscription) =>
        row.current_period_end ? new Date(row.current_period_end).toLocaleDateString('fr-FR') : 'Permanent',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Abonnements" description={`${totalCount} abonnements au total`} />

      <Filters
        filters={[
          {
            label: 'Statut',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'Actifs', value: 'active' },
              { label: 'Tous', value: 'all' },
              { label: 'Annulés', value: 'canceled' },
              { label: 'Expirés', value: 'expired' },
            ],
          },
        ]}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      <AdminTable
        data={subscriptions}
        columns={columns}
        loading={loading}
        emptyMessage="Aucun abonnement trouvé"
      />

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
