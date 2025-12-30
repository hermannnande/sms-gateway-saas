'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Trash2, Send, Download, X, Calendar, Phone, MessageSquare } from 'lucide-react'

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

type Device = {
  id: string
  name: string
}

export function MessagesInbox({ 
  messages, 
  devices 
}: { 
  messages: Message[]
  devices: Device[]
}) {
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDevice, setFilterDevice] = useState<string>('all')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Filtrage des messages
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // Recherche par numéro ou contenu
      if (searchQuery && !msg.to_phone_e164.includes(searchQuery) && !msg.body_final.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Filtre par status
      if (filterStatus !== 'all' && msg.status !== filterStatus) {
        return false
      }

      // Filtre par date début
      if (filterDateStart && new Date(msg.created_at) < new Date(filterDateStart)) {
        return false
      }

      // Filtre par date fin
      if (filterDateEnd && new Date(msg.created_at) > new Date(filterDateEnd + 'T23:59:59')) {
        return false
      }

      return true
    })
  }, [messages, searchQuery, filterStatus, filterDateStart, filterDateEnd])

  // Sélection/désélection de tous les messages
  function toggleSelectAll() {
    if (selectedMessages.length === filteredMessages.length) {
      setSelectedMessages([])
    } else {
      setSelectedMessages(filteredMessages.map(m => m.id))
    }
  }

  // Toggle selection d'un message
  function toggleMessageSelection(messageId: string) {
    if (selectedMessages.includes(messageId)) {
      setSelectedMessages(selectedMessages.filter(id => id !== messageId))
    } else {
      setSelectedMessages([...selectedMessages, messageId])
    }
  }

  // Supprimer les messages sélectionnés
  async function handleDeleteSelected() {
    if (!confirm(`Supprimer ${selectedMessages.length} message(s) ?`)) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', selectedMessages)

      if (error) throw error

      setActionMessage({ type: 'success', text: `${selectedMessages.length} message(s) supprimé(s)` })
      setSelectedMessages([])
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Statistiques
  const stats = useMemo(() => {
    return {
      total: messages.length,
      queued: messages.filter(m => m.status === 'queued').length,
      sent: messages.filter(m => m.status === 'sent').length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      failed: messages.filter(m => m.status === 'failed').length,
    }
  }, [messages])

  // Réinitialiser les filtres
  function resetFilters() {
    setSearchQuery('')
    setFilterStatus('all')
    setFilterDevice('all')
    setFilterDateStart('')
    setFilterDateEnd('')
  }

  // Status badge
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

  return (
    <div className="space-y-6">
      {/* Action message */}
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

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<MessageSquare className="h-5 w-5" />}
          color="bg-blue-50 text-blue-700 border-blue-200"
        />
        <StatCard
          label="En attente"
          value={stats.queued}
          icon={<Calendar className="h-5 w-5" />}
          color="bg-gray-50 text-gray-700 border-gray-200"
        />
        <StatCard
          label="Envoyés"
          value={stats.sent}
          icon={<Send className="h-5 w-5" />}
          color="bg-yellow-50 text-yellow-700 border-yellow-200"
        />
        <StatCard
          label="Livrés"
          value={stats.delivered}
          icon={<Phone className="h-5 w-5" />}
          color="bg-green-50 text-green-700 border-green-200"
        />
        <StatCard
          label="Échecs"
          value={stats.failed}
          icon={<X className="h-5 w-5" />}
          color="bg-red-50 text-red-700 border-red-200"
        />
      </div>

      {/* Barre de recherche et actions */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Recherche */}
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

          {/* Boutons actions */}
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
            {(filterStatus !== 'all' || filterDateStart || filterDateEnd) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Panneau de filtres avancés */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
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

              {/* Date début */}
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Date début
                </label>
                <input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                />
              </div>

              {/* Date fin */}
              <div>
                <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Date fin
                </label>
                <input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions en masse */}
      {selectedMessages.length > 0 && (
        <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-5 shadow-sm animate-slide-down">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {selectedMessages.length}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selectedMessages.length} message{selectedMessages.length > 1 ? 's' : ''} sélectionné{selectedMessages.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Choisissez une action à effectuer
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteSelected}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
              <button
                onClick={() => setSelectedMessages([])}
                className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Résultats */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* En-tête du tableau */}
        <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={filteredMessages.length > 0 && selectedMessages.length === filteredMessages.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-border cursor-pointer accent-primary"
            />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Tous les messages
              </h3>
              <p className="text-xs text-muted-foreground">
                {filteredMessages.length} résultat{filteredMessages.length > 1 ? 's' : ''} trouvé{filteredMessages.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <p className="text-sm text-muted-foreground mb-6">
              Essayez de modifier vos filtres de recherche
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left w-12"></th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Numéro
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Message
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Campagne
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMessages.map((msg) => (
                  <tr 
                    key={msg.id}
                    className="hover:bg-muted/20 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedMessages.includes(msg.id)}
                        onChange={() => toggleMessageSelection(msg.id)}
                        className="w-4 h-4 rounded border-border cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {msg.to_phone_e164}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {msg.body_final}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(msg.status)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {msg.campaigns?.name || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">
                          {new Date(msg.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string
  value: number
  icon: React.ReactNode
  color: string 
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-80">
          {label}
        </span>
        <div className="opacity-60">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold">
        {value}
      </p>
    </div>
  )
}

