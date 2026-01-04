'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadUsers()
  }, [currentPage, search, statusFilter])

  async function loadUsers() {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('app_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    if (statusFilter === 'confirmed') {
      query = query.not('email_confirmed_at', 'is', null)
    } else if (statusFilter === 'unconfirmed') {
      query = query.is('email_confirmed_at', null)
    }

    const { data, count, error } = await query

    if (!error && data) {
      setUsers(data)
      setTotalCount(count || 0)
    }
    setLoading(false)
  }

  const columns = [
    { header: 'Email', accessor: 'email' as keyof User },
    {
      header: 'Statut',
      accessor: (row: User) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.email_confirmed_at ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {row.email_confirmed_at ? '✓ Confirmé' : '⏳ En attente'}
        </span>
      ),
    },
    {
      header: 'Inscrit le',
      accessor: (row: User) => new Date(row.created_at).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Dernière connexion',
      accessor: (row: User) =>
        row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleDateString('fr-FR') : '-',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" description={`${totalCount} utilisateurs inscrits`} />

      <Filters
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher par email..."
        filters={[
          {
            label: 'Statut',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'Tous', value: 'all' },
              { label: 'Confirmés', value: 'confirmed' },
              { label: 'Non confirmés', value: 'unconfirmed' },
            ],
          },
        ]}
      />

      <AdminTable data={users} columns={columns} loading={loading} emptyMessage="Aucun utilisateur trouvé" />

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
