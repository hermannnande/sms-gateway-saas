'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'
import { createClient } from '@/lib/supabase/client'

interface Org {
  id: string
  name: string
  created_at: string
  subscription?: {
    plan: {
      name: string
      max_devices: number
      sms_quota_month: number
    }
    current_period_end: string | null
  }
  devices_count?: number
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadOrgs()
  }, [currentPage, search])

  async function loadOrgs() {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('organizations')
      .select(
        `
        *,
        subscriptions!inner(
          plan:plans(*),
          current_period_end,
          status
        )
      `,
        { count: 'exact' }
      )
      .eq('subscriptions.status', 'active')
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, count, error } = await query

    if (!error && data) {
      // Count devices per org
      const orgsWithDevices = await Promise.all(
        data.map(async (org: any) => {
          const { count: devicesCount } = await supabase
            .from('devices')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', org.id)

          return {
            ...org,
            subscription: Array.isArray(org.subscriptions) ? org.subscriptions[0] : org.subscriptions,
            devices_count: devicesCount || 0,
          }
        })
      )

      setOrgs(orgsWithDevices)
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  const columns = [
    { header: 'Nom', accessor: 'name' as keyof Org },
    {
      header: 'Plan',
      accessor: (row: Org) => row.subscription?.plan?.name || 'free',
    },
    {
      header: 'Appareils',
      accessor: (row: Org) => `${row.devices_count || 0} / ${row.subscription?.plan?.max_devices || 1}`,
    },
    {
      header: 'Quota SMS',
      accessor: (row: Org) =>
        row.subscription?.plan?.sms_quota_month === -1
          ? 'Illimité'
          : (row.subscription?.plan?.sms_quota_month || 100).toLocaleString(),
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
