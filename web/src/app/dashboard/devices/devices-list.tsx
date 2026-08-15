'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertCircle, CheckSquare, Square } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'

type Device = {
  id: string
  name: string
  selected_subscription_id: string | null
  last_seen_at: string | null
  status: string
  created_at: string
}

type DevicesListProps = {
  devices: Device[]
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
}

export function DevicesList({
  devices,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
}: DevicesListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteMultiple, setConfirmDeleteMultiple] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handlePageChange = (page: number) => {
    router.push(`/dashboard/devices?page=${page}`)
  }

  // Toggle selection d'un device
  const toggleSelection = (deviceId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId)
    } else {
      newSelected.add(deviceId)
    }
    setSelectedIds(newSelected)
  }

  // Sélectionner tous
  const selectAll = () => {
    if (selectedIds.size === devices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(devices.map((d) => d.id)))
    }
  }

  const deleteDevices = async (ids: string[]) => {
    const response = await fetch('/api/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'La suppression de l’appareil a échoué')
    }
  }

  // Supprimer un seul device
  const handleDeleteSingle = async (deviceId: string) => {
    if (confirmDeleteId !== deviceId) {
      setConfirmDeleteId(deviceId)
      return
    }

    setDeletingIds(new Set([deviceId]))
    setIsDeleting(true)
    try {
      await deleteDevices([deviceId])
      router.refresh()
    } catch (err) {
      console.error('Error deleting device:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingIds(new Set())
      setConfirmDeleteId(null)
      setIsDeleting(false)
    }
  }

  // Supprimer plusieurs devices
  const handleDeleteMultiple = async () => {
    if (!confirmDeleteMultiple) {
      setConfirmDeleteMultiple(true)
      return
    }

    setDeletingIds(new Set(selectedIds))
    setIsDeleting(true)
    try {
      await deleteDevices(Array.from(selectedIds))
      router.refresh()
    } catch (err) {
      console.error('Error deleting devices:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingIds(new Set())
      setConfirmDeleteMultiple(false)
      setSelectedIds(new Set())
      setIsDeleting(false)
    }
  }

  if (devices.length === 0) {
    return (
      <div className="bg-card rounded-lg p-16 text-center border border-border shadow-sm">
        <div className="text-7xl mb-6">📱</div>
        <h3 className="text-2xl font-bold mb-3">Aucun appareil connecté</h3>
        <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
          Ajoutez votre premier appareil Android pour commencer à envoyer des SMS
        </p>
        <div className="inline-block px-6 py-3 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-sm font-semibold text-primary">
            💡 Cliquez sur &quot;Ajouter un appareil&quot; pour scanner le QR code
          </p>
        </div>
      </div>
    )
  }

  const allSelected = selectedIds.size === devices.length && devices.length > 0

  return (
    <div className="space-y-4">
      {/* Barre d'actions en haut */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-4">
          {/* Sélectionner tout */}
          <button
            onClick={selectAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted border border-border rounded-lg transition-all"
          >
            {allSelected ? (
              <>
                <CheckSquare className="w-4 h-4 text-primary" />
                Tout désélectionner
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Tout sélectionner
              </>
            )}
          </button>

          {/* Compteur de sélection */}
          {selectedIds.size > 0 && (
            <span className="text-sm font-medium text-muted-foreground">
              {selectedIds.size} appareil{selectedIds.size > 1 ? 's' : ''} sélectionné
              {selectedIds.size > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Bouton supprimer sélectionnés */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            {confirmDeleteMultiple ? (
              <>
                <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Supprimer {selectedIds.size} appareil{selectedIds.size > 1 ? 's' : ''} ?
                </div>
                <button
                  onClick={handleDeleteMultiple}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isDeleting ? 'Suppression...' : 'Oui, supprimer'}
                </button>
                <button
                  onClick={() => setConfirmDeleteMultiple(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-all"
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteMultiple}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:bg-destructive/90 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer la sélection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Liste des appareils */}
      <div className="space-y-3">
        {devices.map((device) => {
          const isOnline =
            !!device.last_seen_at &&
            Date.now() - new Date(device.last_seen_at).getTime() < 5 * 60 * 1000

          const isConfirmingDelete = confirmDeleteId === device.id
          const isDeviceDeleting = deletingIds.has(device.id)
          const isSelected = selectedIds.has(device.id)

          return (
            <div
              key={device.id}
              className={`bg-card rounded-lg p-5 border transition-all ${
                isOnline
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-border hover:border-border/80'
              } ${isConfirmingDelete ? 'ring-2 ring-destructive' : ''} ${
                isSelected ? 'ring-2 ring-primary border-primary/50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Checkbox + Icon + Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelection(device.id)}
                    className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-all"
                    disabled={isDeviceDeleting}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Icon */}
                  <div className="relative flex-shrink-0">
                    <span className="text-4xl">📱</span>
                    {isOnline && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse"></span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg text-foreground truncate">
                        {device.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 ${
                          isOnline
                            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-green-500' : 'bg-muted-foreground'
                          }`}
                        ></span>
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {device.last_seen_at && (
                        <div className="flex items-center gap-1.5">
                          <span>⏰</span>
                          <span>
                            {new Date(device.last_seen_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>
                          {new Date(device.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      {device.selected_subscription_id && (
                        <div className="flex items-center gap-1.5">
                          <span>📶</span>
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border border-border">
                            SIM {device.selected_subscription_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Delete Button */}
                <div className="flex-shrink-0">
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-sm text-destructive font-medium mr-2">
                        <AlertCircle className="w-4 h-4" />
                        Confirmer ?
                      </div>
                      <button
                        onClick={() => handleDeleteSingle(device.id)}
                        disabled={isDeviceDeleting}
                        className="px-3 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isDeviceDeleting ? '...' : 'Oui'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isDeviceDeleting}
                        className="px-3 py-2 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-all"
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDeleteSingle(device.id)}
                      disabled={isDeviceDeleting}
                      className="p-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-all disabled:opacity-50"
                      title="Supprimer cet appareil"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}
