'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, parseTXT, parseExcel, normalizePhoneCI } from '@/lib/phone'
import { Upload, FileText, Table, X, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'

type ParsedContact = { phone: string; name?: string }

const ACCEPTED_EXTENSIONS = '.csv,.txt,.xls,.xlsx'
const ACCEPTED_MIME = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function getFileType(file: File): 'csv' | 'txt' | 'excel' | null {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'txt') return 'txt'
  if (ext === 'xls' || ext === 'xlsx') return 'excel'
  return null
}

export function ImportContactsModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedContact[]>([])
  const [totalParsed, setTotalParsed] = useState(0)
  const [validCount, setValidCount] = useState(0)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const router = useRouter()

  const processFile = useCallback(async (selectedFile: File) => {
    const type = getFileType(selectedFile)
    if (!type) {
      setError('Format non supporté. Utilisez CSV, TXT, XLS ou XLSX.')
      return
    }

    setFile(selectedFile)
    setFileType(type)
    setError(null)
    setImportResult(null)

    try {
      let contacts: ParsedContact[] = []

      if (type === 'excel') {
        const buffer = await selectedFile.arrayBuffer()
        contacts = parseExcel(buffer)
      } else {
        const content = await selectedFile.text()
        contacts = type === 'csv' ? parseCSV(content) : parseTXT(content)
      }

      setTotalParsed(contacts.length)
      const valid = contacts.filter(c => normalizePhoneCI(c.phone) !== null)
      setValidCount(valid.length)
      setPreview(contacts.slice(0, 8))
    } catch (err: any) {
      setError(`Erreur de lecture: ${err.message}`)
    }
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) processFile(selectedFile)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) processFile(droppedFile)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const type = getFileType(file)
      let contacts: ParsedContact[] = []

      if (type === 'excel') {
        const buffer = await file.arrayBuffer()
        contacts = parseExcel(buffer)
      } else {
        const content = await file.text()
        contacts = type === 'csv' ? parseCSV(content) : parseTXT(content)
      }

      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Non authentifié')

      const { data: orgMember } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userData.user.id)
        .single()

      if (!orgMember) throw new Error('Organisation introuvable')

      let skipped = 0
      const contactsToInsert = contacts
        .map((contact) => {
          const phoneNormalized = normalizePhoneCI(contact.phone)
          if (!phoneNormalized) { skipped++; return null }
          return {
            org_id: orgMember.org_id,
            phone_e164: phoneNormalized,
            name: contact.name || null,
            opt_in: true,
          }
        })
        .filter(Boolean)

      if (contactsToInsert.length === 0) {
        throw new Error('Aucun numéro valide trouvé dans le fichier')
      }

      // Batch insert (Supabase limit ~1000 per request)
      const batchSize = 500
      let imported = 0
      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize)
        const { error: insertError, count } = await supabase
          .from('contacts')
          .upsert(batch, { onConflict: 'org_id,phone_e164', ignoreDuplicates: true })

        if (insertError) throw insertError
        imported += batch.length
      }

      setImportResult({ imported, skipped })
      setTimeout(() => { router.refresh(); onClose() }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fileIcon = fileType === 'excel'
    ? <FileSpreadsheet className="h-5 w-5 text-green-600" />
    : fileType === 'txt'
      ? <FileText className="h-5 w-5 text-gray-600" />
      : <Table className="h-5 w-5 text-blue-600" />

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-xl font-bold">Importer des contacts</h2>
            <p className="text-sm text-muted-foreground">CSV, Excel (XLS, XLSX) ou TXT</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Success message */}
          {importResult && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">{importResult.imported} contact(s) importé(s) avec succès</p>
                {importResult.skipped > 0 && (
                  <p className="text-sm opacity-80">{importResult.skipped} numéro(s) ignoré(s) (format invalide)</p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? 'border-primary bg-primary/5'
                : file
                  ? 'border-green-300 bg-green-50/50'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                {fileIcon}
                <div className="text-left">
                  <p className="font-semibold text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} Ko &bull; {totalParsed} ligne(s) &bull;{' '}
                    <span className="text-green-600 font-medium">{validCount} valide(s)</span>
                    {totalParsed - validCount > 0 && (
                      <span className="text-orange-600 font-medium"> &bull; {totalParsed - validCount} invalide(s)</span>
                    )}
                  </p>
                </div>
                <button onClick={() => { setFile(null); setPreview([]); setTotalParsed(0); setValidCount(0); setImportResult(null) }}
                  className="ml-4 p-1.5 hover:bg-muted rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium mb-1">Glissez votre fichier ici</p>
                <p className="text-xs text-muted-foreground mb-4">ou cliquez pour parcourir</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/90 transition">
                  <Upload className="h-4 w-4" />
                  Choisir un fichier
                  <input type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileChange} className="hidden" />
                </label>
              </>
            )}
          </div>

          {/* Format hints */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Table className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-800">CSV</p>
                <p className="text-[10px] text-blue-600">Téléphone +225, Nom client</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
              <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-green-800">Excel</p>
                <p className="text-[10px] text-green-600">XLS, XLSX</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <FileText className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-800">TXT</p>
                <p className="text-[10px] text-gray-600">1 num/ligne</p>
              </div>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Aperçu ({Math.min(8, totalParsed)} sur {totalParsed})
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Téléphone</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Nom</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Normalisé</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Valide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((c, i) => {
                    const normalized = normalizePhoneCI(c.phone)
                    return (
                      <tr key={i} className={normalized ? '' : 'bg-red-50/50'}>
                        <td className="px-4 py-2 font-mono text-xs">{c.phone}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{c.name || '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs">{normalized || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          {normalized
                            ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs">✓</span>
                            : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs">✗</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {file ? `${validCount} contact(s) valide(s) seront importés` : 'Sélectionnez un fichier pour commencer'}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading || validCount === 0 || !!importResult}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importation...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importer {validCount > 0 ? `(${validCount})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
