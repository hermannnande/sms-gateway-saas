'use client'

import { useState } from 'react'
import { AddDeviceModal } from './add-device-modal'

export function AddDeviceButton({ canAdd }: { canAdd: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!canAdd) {
    return (
      <button
        disabled
        className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold text-lg border-3 border-border cursor-not-allowed opacity-50 flex items-center gap-2"
        title="Limite d'appareils atteinte - Passez à un plan supérieur"
      >
        <span className="text-2xl">🔒</span>
        Limite atteinte
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-gradient-primary text-white rounded-xl font-bold text-lg shadow-brutal-primary border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200 flex items-center gap-2 group"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
        Ajouter appareil
      </button>

      {isOpen && <AddDeviceModal onClose={() => setIsOpen(false)} />}
    </>
  )
}


