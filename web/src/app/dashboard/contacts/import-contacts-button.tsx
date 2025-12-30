'use client'

import { useState } from 'react'
import { ImportContactsModal } from './import-contacts-modal'

export function ImportContactsButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-secondary text-white rounded-xl font-bold text-lg shadow-brutal-sm border-3 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200 flex items-center gap-2 group"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform">📥</span>
        Importer contacts
      </button>

      {isOpen && <ImportContactsModal onClose={() => setIsOpen(false)} />}
    </>
  )
}


