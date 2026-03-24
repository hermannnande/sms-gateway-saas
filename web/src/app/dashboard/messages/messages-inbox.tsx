'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Filter, Trash2, Download, X, Calendar,
  Phone, MessageSquare, Send, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react'

type Message = {
  id: string
  to_phone_e164: string
  body_final: string
  status: string
  created_at: string
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  error_message: string | null
  campaigns: { name: string } | null
}

type Device = { id: string; name: string }

export function MessagesInbox({
  messages,
  devices,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  statusFilter,
  statusCounts,
}: {
  messages: Message[]
  devices: Device[]
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  statusFilter: string
  statusCounts: Record<string, number>
}) {
  const router = useRouter()
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function navigateTo(page: number, status?: string) {
    const s = status ?? statusFilter
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (s !== 'all') params.set('status', s)
    router.push(`/dashboard/messages?${params.toString()}`)
  }

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (searchQuery && !msg.to_phone_e164.includes(searchQuery) && !msg.body_final.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (filterDateStart && new Date(msg.created_at) < new Date(filterDateStart)) return false
      if (filterDateEnd && new Date(msg.created_at) > new Date(filterDateEnd + 'T23:59:59')) return false
      return true
    })
  }, [messages, searchQuery, filterDateStart, filterDateEnd])

  function toggleSelectAll() {
    if (selectedMessages.length === filteredMessages.length) {
      setSelectedMessages([])
    } else {
      setSelectedMessages(filteredMessages.map(m => m.id))
    }
  }

  function toggleMessageSelection(id: string) {
    setSelectedMessages(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleDeleteSelected() {
    if (!confirm(`Supprimer ${selectedMessages.length} message(s) ?`)) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('messages').delete().in('id', selectedMessages)
      if (error) throw error
      setActionMessage({ type: 'success', text: `${selectedMessages.length} message(s) supprimé(s)` })
      setSelectedMessages([])
      setTimeout(() => router.refresh(), 1000)
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setSearchQuery('')
    setFilterDateStart('')
    setFilterDateEnd('')
    navigateTo(1, 'all')
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { color: string; label: string; icon: string }> = {
      queued: { color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'En attente', icon: '⏳' },
      claimed: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Récupéré', icon: '📲' },
      sent: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Envoyé', icon: '📤' },
      delivered: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Livré', icon: '✅' },
      failed: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Échec', icon: '❌' },
    }
    const badge = badges[status] || badges.queued
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${badge.color}`}>
        <span>{badge.icon}</span>
        {badge.label}
      </span>
    )
  }

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [currentPage, totalPages])

  return (
    <div className="space-y-6">
      {actionMessage && (
        <div className={`flex items-center justify-between p-4 rounded-xl border shadow-sm ${
          actionMessage.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span className="font-medium">{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={statusCounts['all'] ?? 0} icon={<MessageSquare className="h-5 w-5" />} color="bg-blue-50 text-blue-700 border-blue-200"
          active={statusFilter === 'all'} onClick={() => navigateTo(1, 'all')} />
        <StatCard label="En attente" value={statusCounts['queued'] ?? 0} icon={<Calendar className="h-5 w-5" />} color="bg-gray-50 text-gray-700 border-gray-200"
          active={statusFilter === 'queued'} onClick={() => navigateTo(1, 'queued')} />
        <StatCard label="Envoyés" value={statusCounts['sent'] ?? 0} icon={<Send className="h-5 w-5" />} color="bg-yellow-50 text-yellow-700 border-yellow-200"
          active={statusFilter === 'sent'} onClick={() => navigateTo(1, 'sent')} />
        <StatCard label="Livrés" value={statusCounts['delivered'] ?? 0} icon={<Phone className="h-5 w-5" />} color="bg-green-50 text-green-700 border-green-200"
          active={statusFilter === 'delivered'} onClick={() => navigateTo(1, 'delivered')} />
        <StatCard label="Échecs" value={statusCounts['failed'] ?? 0} icon={<X className="h-5 w-5" />} color="bg-red-50 text-red-700 border-red-200"
          active={statusFilter === 'failed'} onClick={() => navigateTo(1, 'failed')} />
      </div>

      {/* Search + filters */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par numéro ou contenu..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition ${
                showFilters
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtres
            </button>
            {(statusFilter !== 'all' || filterDateStart || filterDateEnd) && (
              <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition">
                <X className="h-4 w-4" />
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => navigateTo(1, e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="queued">En attente</option>
                  <option value="claimed">Récupéré</option>
                  <option value="sent">Envoyé</option>
                  <option value="delivered">Livré</option>
                  <option value="failed">Échec</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Date début</label>
                <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Date fin</label>
                <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedMessages.length > 0 && (
        <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-5 shadow-sm animate-slide-down">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {selectedMessages.length}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedMessages.length} message{selectedMessages.length > 1 ? 's' : ''} sélectionné{selectedMessages.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">Choisissez une action</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDeleteSelected} disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition shadow-sm">
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
              <button onClick={() => setSelectedMessages([])}
                className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted transition">
                <X className="h-4 w-4" /> Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={filteredMessages.length > 0 && selectedMessages.length === filteredMessages.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-border cursor-pointer accent-primary"
            />
            <div>
              <h3 className="text-sm font-semibold">
                {statusFilter === 'all' ? 'Tous les messages' : `Messages: ${statusFilter}`}
              </h3>
              <p className="text-xs text-muted-foreground">
                Messages {startItem}-{endItem} sur {totalCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background"
              defaultValue={pageSize}
              disabled
            >
              <option value={pageSize}>{pageSize}</option>
            </select>
            <button className="p-2 hover:bg-muted rounded-lg transition" title="Télécharger">
              <Download className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucun message trouvé</h3>
            <p className="text-sm text-muted-foreground mb-6">Essayez de modifier vos filtres</p>
            <button onClick={resetFilters} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left w-12"></th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Numéro</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Campagne</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={selectedMessages.includes(msg.id)} onChange={() => toggleMessageSelection(msg.id)}
                        className="w-4 h-4 rounded border-border cursor-pointer accent-primary" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-semibold">{msg.to_phone_e164}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2">{msg.body_final}</p>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(msg.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{msg.campaigns?.name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm">{new Date(msg.created_at).toLocaleDateString('fr-FR')}</span>
                        <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/10">
            <p className="text-sm text-muted-foreground">
              Affichage de <span className="font-semibold text-foreground">{startItem}</span> à <span className="font-semibold text-foreground">{endItem}</span> sur <span className="font-semibold text-foreground">{totalCount}</span> messages
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateTo(1)}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Première page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigateTo(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => navigateTo(p as number)}
                    className={`min-w-[36px] h-9 rounded-lg border text-sm font-medium transition ${
                      p === currentPage
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => navigateTo(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigateTo(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Dernière page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, color, active, onClick,
}: {
  label: string; value: number; icon: React.ReactNode; color: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-5 shadow-sm transition-all hover:shadow-md text-left w-full ${color} ${
        active ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</span>
        <div className="opacity-60">{icon}</div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </button>
  )
}
