'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, AlertCircle, CheckSquare, Square } from 'lucide-react'

type Device = {
  id: string
  name: string
  selected_subscription_id: string | null
  last_seen_at: string | null
  status: string
  created_at: string
}

export function DevicesList({ devices }: { devices: Device[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteMultiple, setConfirmDeleteMultiple] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Supprimer un seul device
  const handleDeleteSingle = async (deviceId: string) => {
    if (confirmDeleteId !== deviceId) {
      setConfirmDeleteId(deviceId)
      return
    }

    setDeletingIds(new Set([deviceId]))
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('devices').delete().eq('id', deviceId)

      if (error) {
        console.error('Error deleting device:', error)
        alert('Erreur lors de la suppression: ' + error.message)
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Erreur lors de la suppression')
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
      const supabase = createClient()
      const { error } = await supabase.from('devices').delete().in('id', Array.from(selectedIds))

      if (error) {
        console.error('Error deleting devices:', error)
        alert('Erreur lors de la suppression: ' + error.message)
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Erreur lors de la suppression')
    } finally {
      setDeletingIds(new Set())
      setConfirmDeleteMultiple(false)
      setSelectedIds(new Set())
      setIsDeleting(false)
    }
  }
  if (devices.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-16 text-center border-4 border-black/10 dark:border-white/10 animate-fade-in">
        <div className="text-7xl mb-6 animate-float">📱</div>
        <h3 className="text-2xl font-black mb-3">Aucun appareil connecté</h3>
        <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
          Ajoutez votre premier appareil Android pour commencer à envoyer des SMS
        </p>
        <div className="inline-block px-6 py-3 bg-primary/10 border-2 border-primary/30 rounded-xl">
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
      {devices.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center gap-4">
            {/* Sélectionner tout */}
            <button
              onClick={selectAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white border border-gray-300 rounded-lg transition-all"
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
              <span className="text-sm font-semibold text-gray-600">
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
                  <div className="flex items-center gap-2 text-sm text-red-600 font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    Supprimer {selectedIds.size} appareil{selectedIds.size > 1 ? 's' : ''} ?
                  </div>
                  <button
                    onClick={handleDeleteMultiple}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isDeleting ? 'Suppression...' : 'Oui, supprimer'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteMultiple(false)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-all"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDeleteMultiple}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer la sélection
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Liste des appareils */}
      {devices.map((device) => {
        // Plus robuste: on considère "en ligne" si on a vu l’appareil récemment,
        // même si le champ status n’a pas encore été mis à jour.
        const isOnline =
          !!device.last_seen_at &&
          Date.now() - new Date(device.last_seen_at).getTime() < 5 * 60 * 1000 // 5 min
        
        const isConfirmingDelete = confirmDeleteId === device.id
        const isDeviceDeleting = deletingIds.has(device.id)
        const isSelected = selectedIds.has(device.id)

        return (
          <div
            key={device.id}
            className={`glass-card rounded-2xl p-6 border-2 transition-all duration-300 ${
              isOnline 
                ? 'border-green-500/30 bg-green-500/5' 
                : 'border-gray-200 hover:border-gray-300'
            } ${isConfirmingDelete ? 'ring-2 ring-red-500 border-red-300' : ''} ${
              isSelected ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Left: Checkbox + Icon + Info */}
              <div className="flex items-center gap-4 flex-1">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelection(device.id)}
                  className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-all"
                  disabled={isDeviceDeleting}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <div className="relative">
                  <span className="text-5xl">📱</span>
                  {isOnline && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-xl text-gray-900">{device.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        isOnline
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                      {isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
                    {device.last_seen_at && (
                      <div className="flex items-center gap-1.5">
                        <span>⏰</span>
                        <span>Vu: {new Date(device.last_seen_at).toLocaleString('fr-FR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Ajouté: {new Date(device.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {device.selected_subscription_id && (
                      <div className="flex items-center gap-1.5">
                        <span>📶</span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded border">
                          SIM {device.selected_subscription_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Delete Button */}
              <div className="ml-4">
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-red-600 font-semibold mr-2">
                      <AlertCircle className="w-4 h-4" />
                      Confirmer ?
                    </div>
                    <button
                      onClick={() => handleDeleteSingle(device.id)}
                      disabled={isDeviceDeleting}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isDeviceDeleting ? 'Suppression...' : 'Oui, supprimer'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isDeviceDeleting}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDeleteSingle(device.id)}
                    disabled={isDeviceDeleting}
                    className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-all group/delete disabled:opacity-50"
                    title="Supprimer cet appareil"
                  >
                    <Trash2 className="w-5 h-5 group-hover/delete:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}


