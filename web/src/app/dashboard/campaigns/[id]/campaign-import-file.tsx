'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  downloadCampaignImportFile,
  formatFileSize,
  type CampaignImportFile,
} from '@/lib/campaign-imports'

export function CampaignImportFileCard({ file }: { file: CampaignImportFile | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!file) return null

  const handleDownload = async () => {
    setError(null)
    setBusy(true)
    try {
      await downloadCampaignImportFile(createClient(), file)
    } catch (err: any) {
      setError(`Téléchargement impossible : ${err.message}`)
    }
    setBusy(false)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl leading-none">📂</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold mb-1">Fichier importé</p>
            <p className="text-sm break-all">{file.file_name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              <span>{formatFileSize(file.size_bytes)}</span>
              <span>👥 {file.contact_count.toLocaleString('fr-FR')} contacts</span>
              {file.invalid_count > 0 && (
                <span className="text-amber-600">
                  ⚠️ {file.invalid_count} ignoré{file.invalid_count > 1 ? 's' : ''}
                </span>
              )}
              <span>📅 {new Date(file.created_at).toLocaleString('fr-FR')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            disabled={busy}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? '…' : '⬇️ Télécharger'}
          </button>
          <Link
            href="/dashboard/imports"
            className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition whitespace-nowrap"
          >
            Gérer
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mt-3">
          {error}
        </p>
      )}
    </div>
  )
}
