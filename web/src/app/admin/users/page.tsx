'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'
import { Pagination } from '@/components/admin/pagination'

interface User {
  user_id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  last_web_seen_at: string | null
  last_mobile_seen_at: string | null
  is_admin: boolean
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
    const qs = new URLSearchParams({
      search,
      status: statusFilter,
      page: String(currentPage - 1),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/admin/users?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    if (json?.ok) {
      setUsers(json.items || [])
      setTotalCount(json.total || 0)
    } else {
      setUsers([])
      setTotalCount(0)
    }
    setLoading(false)
  }

  const columns = [
    { header: 'Email', accessor: (row: User) => row.email || '—' },
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
      header: 'Admin',
      accessor: (row: User) =>
        row.is_admin ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            SUPER
          </span>
        ) : (
          '—'
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
    {
      header: 'Vu Web',
      accessor: (row: User) => (row.last_web_seen_at ? new Date(row.last_web_seen_at).toLocaleDateString('fr-FR') : '-'),
    },
    {
      header: 'Vu Mobile',
      accessor: (row: User) =>
        row.last_mobile_seen_at ? new Date(row.last_mobile_seen_at).toLocaleDateString('fr-FR') : '-',
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
