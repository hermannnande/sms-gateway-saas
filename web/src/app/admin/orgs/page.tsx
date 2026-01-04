'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'

interface Org {
  id: string
  name: string
  created_at: string
  devices_count: number
  plan_name: string | null
  max_devices: number | null
  sms_quota_month: number | null
  price_xof: number | null
  current_period_end: string | null
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadOrgs()
  }, [currentPage, search])

  async function loadOrgs() {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      search,
      page: String(currentPage - 1),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/admin/orgs?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (json?.ok) {
      setOrgs(json.items || [])
      setTotalCount(json.total || 0)
    } else {
      setOrgs([])
      setTotalCount(0)
      setError(json?.error || `Erreur API (${res.status})`)
    }
    setLoading(false)
  }

  const columns = [
    { header: 'Nom', accessor: 'name' as keyof Org },
    {
      header: 'Plan',
      accessor: (row: Org) => row.plan_name || 'free',
    },
    {
      header: 'Appareils',
      accessor: (row: Org) => `${row.devices_count || 0} / ${row.max_devices || 1}`,
    },
    {
      header: 'Quota SMS',
      accessor: (row: Org) =>
        row.sms_quota_month === -1
          ? 'Illimité'
          : (row.sms_quota_month || 100).toLocaleString(),
    },
    {
      header: 'Fin',
      accessor: (row: Org) =>
        row.current_period_end ? new Date(row.current_period_end).toLocaleDateString('fr-FR') : '—',
    },
    {
      header: 'Créé le',
      accessor: (row: Org) => new Date(row.created_at).toLocaleDateString('fr-FR'),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Organisations" description={`${totalCount} organisations actives`} />

      <Filters searchValue={search} onSearchChange={setSearch} searchPlaceholder="Rechercher par nom..." />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      <AdminTable data={orgs} columns={columns} loading={loading} emptyMessage="Aucune organisation trouvée" />

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
