'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  deleteCampaignImportFiles,
  downloadCampaignImportFile,
  formatFileSize,
  getFileExtension,
  type CampaignImportFile,
} from '@/lib/campaign-imports'

type ImportRow = CampaignImportFile & {
  campaigns: { name: string; status: string } | null
}

const EXTENSION_ICONS: Record<string, string> = {
  csv: '📄',
  txt: '📄',
  xls: '📊',
  xlsx: '📊',
}

export function ImportsList({ files }: { files: ImportRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return files
    return files.filter(
      (f) =>
        f.file_name.toLowerCase().includes(q) ||
        (f.campaigns?.name ?? f.campaign_name ?? '').toLowerCase().includes(q),
    )
  }, [files, searchQuery])

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) {
      setSelected([])
    } else {
      setSelected(filtered.map((f) => f.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleDownload = async (file: ImportRow) => {
    setError(null)
    setBusyId(file.id)
    try {
      await downloadCampaignImportFile(createClient(), file)
    } catch (err: any) {
      setError(`Téléchargement impossible : ${err.message}`)
    }
    setBusyId(null)
  }

  const handleDelete = async (file: ImportRow) => {
    if (
      !confirm(
        `Supprimer définitivement « ${file.file_name} » ? La campagne et ses messages ne sont pas affectés.`,
      )
    ) {
      return
    }
    setError(null)
    setBusyId(file.id)
    try {
      await deleteCampaignImportFiles(createClient(), [file])
      setSelected((prev) => prev.filter((id) => id !== file.id))
      router.refresh()
    } catch (err: any) {
      setError(`Suppression impossible : ${err.message}`)
    }
    setBusyId(null)
  }

  const handleDeleteSelected = async () => {
    const targets = filtered.filter((f) => selected.includes(f.id))
    if (targets.length === 0) return
    if (
      !confirm(
        `Supprimer définitivement ${targets.length} fichier(s) ? Les campagnes et leurs messages ne sont pas affectés.`,
      )
    ) {
      return
    }
    setError(null)
    setBulkBusy(true)
    try {
      await deleteCampaignImportFiles(createClient(), targets)
      setSelected([])
      router.refresh()
    } catch (err: any) {
      setError(`Suppression impossible : ${err.message}`)
    }
    setBulkBusy(false)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
        <input
          type="text"
          placeholder="🔍 Rechercher par nom de fichier ou de campagne..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
      </div>

      {selected.length > 0 && (
        <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/30 flex flex-wrap items-center gap-3">
          <p className="font-semibold text-sm">
            {selected.length} fichier(s) sélectionné(s)
          </p>
          <button
            onClick={handleDeleteSelected}
            disabled={bulkBusy}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50"
          >
            {bulkBusy ? 'Suppression…' : '🗑️ Supprimer la sélection'}
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected.length === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm font-medium">Tout sélectionner</span>
          <span className="text-xs text-muted-foreground">
            ({filtered.length} fichier{filtered.length > 1 ? 's' : ''} affiché
            {filtered.length > 1 ? 's' : ''})
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center border border-border">
          <div className="text-5xl mb-4">📂</div>
          <p className="text-muted-foreground">
            {files.length === 0
              ? 'Aucun fichier importé pour le moment.'
              : 'Aucun fichier ne correspond à cette recherche.'}
          </p>
          {files.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Les fichiers choisis lors de la création d&apos;une campagne apparaîtront ici.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((file) => {
            const campaignName = file.campaigns?.name ?? file.campaign_name
            const campaignDeleted = !file.campaign_id || !file.campaigns
            return (
              <div
                key={file.id}
                className="bg-card rounded-lg p-4 border border-border shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(file.id)}
                    onChange={() => toggleSelect(file.id)}
                    className="mt-1 w-4 h-4 rounded border-border"
                  />

                  <span className="text-2xl leading-none mt-0.5">
                    {EXTENSION_ICONS[getFileExtension(file.file_name)] ?? '📎'}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm break-all">
                        {file.file_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size_bytes)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        📅 {new Date(file.created_at).toLocaleString('fr-FR')}
                      </span>
                      <span>👥 {file.contact_count.toLocaleString('fr-FR')} contacts</span>
                      {file.invalid_count > 0 && (
                        <span className="text-amber-600">
                          ⚠️ {file.invalid_count} ignoré{file.invalid_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {campaignDeleted ? (
                        <span className="italic">
                          🚀 {campaignName ? `${campaignName} (campagne supprimée)` : 'Campagne supprimée'}
                        </span>
                      ) : (
                        <Link
                          href={`/dashboard/campaigns/${file.campaign_id}`}
                          className="text-primary hover:underline"
                        >
                          🚀 {campaignName}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={busyId === file.id}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {busyId === file.id ? '…' : '⬇️ Télécharger'}
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={busyId === file.id}
                      className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
