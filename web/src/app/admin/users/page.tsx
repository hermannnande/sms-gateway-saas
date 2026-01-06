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

interface ResetPasswordModalProps {
  user: User | null
  onClose: () => void
  onSuccess: () => void
}

function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, new_password: newPassword }),
      })

      const json = await res.json()

      if (json.ok) {
        onSuccess()
        onClose()
      } else {
        setError(json.error || 'Erreur lors de la modification du mot de passe')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Modifier le mot de passe</h2>
        <p className="text-sm text-gray-600 mb-4">
          Utilisateur : <strong>{user.email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              id="new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimum 6 caractères"
              minLength={6}
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Modification...' : 'Modifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const pageSize = 20

  useEffect(() => {
    loadUsers()
  }, [currentPage, search, statusFilter])

  async function loadUsers() {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      search,
      status: statusFilter,
      page: String(currentPage - 1),
      pageSize: String(pageSize),
    })
    const res = await fetch(`/api/admin/users?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (json?.ok) {
      setUsers(json.items || [])
      setTotalCount(json.total || 0)
    } else {
      setUsers([])
      setTotalCount(0)
      setError(json?.error || `Erreur API (${res.status})`)
    }
    setLoading(false)
  }

  function handlePasswordResetSuccess() {
    setSuccessMessage('Mot de passe modifié avec succès ✓')
    setTimeout(() => setSuccessMessage(null), 3000)
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
    {
      header: 'Actions',
      accessor: (row: User) => (
        <button
          onClick={() => setSelectedUser(row)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔑 Modifier mot de passe
        </button>
      ),
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

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm font-medium">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

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

      <ResetPasswordModal user={selectedUser} onClose={() => setSelectedUser(null)} onSuccess={handlePasswordResetSuccess} />
    </div>
  )
}
