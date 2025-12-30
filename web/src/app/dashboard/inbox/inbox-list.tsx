'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type InboxMessage = {
  id: string
  from_phone_e164: string
  body: string
  received_at: string
  read: boolean
  archived: boolean
  starred: boolean
  replied: boolean
  devices: {
    name: string
    device_token: string
  } | null
}

type Device = {
  id: string
  name: string
}

export function InboxList({ messages, devices }: { messages: InboxMessage[], devices: Device[] }) {
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDevice, setFilterDevice] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Filtrer les messages
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // Recherche textuelle
      if (searchQuery && !msg.body.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !msg.from_phone_e164.includes(searchQuery)) {
        return false
      }

      // Filtre par appareil
      if (filterDevice !== 'all' && msg.devices?.device_token !== filterDevice) {
        return false
      }

      // Filtre par statut
      if (filterStatus === 'unread' && msg.read) return false
      if (filterStatus === 'read' && !msg.read) return false
      if (filterStatus === 'starred' && !msg.starred) return false
      if (filterStatus === 'archived' && !msg.archived) return false
      if (filterStatus === 'replied' && !msg.replied) return false

      // Filtre par date
      if (filterDateStart && new Date(msg.received_at) < new Date(filterDateStart)) {
        return false
      }
      if (filterDateEnd && new Date(msg.received_at) > new Date(filterDateEnd)) {
        return false
      }

      return true
    })
  }, [messages, searchQuery, filterDevice, filterStatus, filterDateStart, filterDateEnd])

  // Sélection
  const handleSelectAll = () => {
    if (selectedMessages.length === filteredMessages.length) {
      setSelectedMessages([])
    } else {
      setSelectedMessages(filteredMessages.map(m => m.id))
    }
  }

  const handleSelectMessage = (id: string) => {
    if (selectedMessages.includes(id)) {
      setSelectedMessages(selectedMessages.filter(mid => mid !== id))
    } else {
      setSelectedMessages([...selectedMessages, id])
    }
  }

  // Actions en masse
  const handleMarkAsRead = async () => {
    const supabase = createClient()
    await supabase
      .from('inbox_messages')
      .update({ read: true })
      .in('id', selectedMessages)
    window.location.reload()
  }

  const handleMarkAsUnread = async () => {
    const supabase = createClient()
    await supabase
      .from('inbox_messages')
      .update({ read: false })
      .in('id', selectedMessages)
    window.location.reload()
  }

  const handleArchive = async () => {
    const supabase = createClient()
    await supabase
      .from('inbox_messages')
      .update({ archived: true })
      .in('id', selectedMessages)
    window.location.reload()
  }

  const handleDelete = async () => {
    if (!confirm(`Supprimer ${selectedMessages.length} message(s) ?`)) return
    const supabase = createClient()
    await supabase
      .from('inbox_messages')
      .delete()
      .in('id', selectedMessages)
    window.location.reload()
  }

  const handleToggleStar = async (id: string, currentStarred: boolean) => {
    const supabase = createClient()
    await supabase
      .from('inbox_messages')
      .update({ starred: !currentStarred })
      .eq('id', id)
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche et filtres */}
      <div className="bg-card rounded-lg p-4 border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Recherche */}
          <input
            type="text"
            placeholder="🔍 Rechercher par numéro ou contenu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />

          {/* Toggle filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition text-sm font-medium"
          >
            {showFilters ? '🔼' : '🔽'} Filtres avancés
          </button>
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-border">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Appareil
              </label>
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Tous les appareils</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Statut
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Tous</option>
                <option value="unread">Non lus</option>
                <option value="read">Lus</option>
                <option value="starred">Favoris</option>
                <option value="archived">Archivés</option>
                <option value="replied">Répondus</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Date début
              </label>
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Date fin
              </label>
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions en masse */}
      {selectedMessages.length > 0 && (
        <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/30">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold text-sm">
              {selectedMessages.length} message(s) sélectionné(s)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleMarkAsRead}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
              >
                ✓ Marquer lu
              </button>
              <button
                onClick={handleMarkAsUnread}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
              >
                📩 Marquer non lu
              </button>
              <button
                onClick={handleArchive}
                className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition"
              >
                📦 Archiver
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sélection tous */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectedMessages.length === filteredMessages.length && filteredMessages.length > 0}
          onChange={handleSelectAll}
          className="w-4 h-4 rounded border-border"
        />
        <span className="text-sm font-medium">Tout sélectionner</span>
        <span className="text-xs text-muted-foreground">
          ({filteredMessages.length} message{filteredMessages.length > 1 ? 's' : ''} affiché{filteredMessages.length > 1 ? 's' : ''})
        </span>
      </div>

      {/* Liste des messages */}
      {filteredMessages.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center border border-border">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-muted-foreground">Aucun message trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`bg-card rounded-lg p-4 border border-border shadow-sm hover:shadow-md transition ${
                !message.read ? 'bg-primary/5 border-primary/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedMessages.includes(message.id)}
                  onChange={() => handleSelectMessage(message.id)}
                  className="mt-1 w-4 h-4 rounded border-border"
                />

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">
                        {message.from_phone_e164}
                      </span>
                      {!message.read && (
                        <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs font-bold">
                          NOUVEAU
                        </span>
                      )}
                      {message.replied && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-700 rounded text-xs font-bold">
                          RÉPONDU
                        </span>
                      )}
                      {message.archived && (
                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-700 rounded text-xs font-bold">
                          ARCHIVÉ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStar(message.id, message.starred)}
                        className="text-xl hover:scale-110 transition"
                      >
                        {message.starred ? '⭐' : '☆'}
                      </button>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(message.received_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm mb-2">{message.body}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>📱 {message.devices?.name || 'Appareil inconnu'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

