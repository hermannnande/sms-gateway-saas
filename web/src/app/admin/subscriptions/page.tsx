'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'
import { createClient } from '@/lib/supabase/client'

interface Subscription {
  id: string
  org_id: string
  plan_id: string
  status: string
  current_period_end: string | null
  created_at: string
  organization: {
    name: string
  }
  plan: {
    name: string
    price_xof: number
  }
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadSubscriptions()
  }, [currentPage, statusFilter])

  async function loadSubscriptions() {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('subscriptions')
      .select(
        `
        *,
        organization:organizations(name),
        plan:plans(name, price_xof)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, count, error } = await query

    if (!error && data) {
      setSubscriptions(data as any)
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  const columns = [
    {
      header: 'Organisation',
      accessor: (row: Subscription) => row.organization?.name || '-',
    },
    {
      header: 'Plan',
      accessor: (row: Subscription) => row.plan?.name || '-',
    },
    {
      header: 'Prix',
      accessor: (row: Subscription) =>
        row.plan?.price_xof === 0 ? 'Gratuit' : `${row.plan?.price_xof.toLocaleString()} F CFA`,
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
