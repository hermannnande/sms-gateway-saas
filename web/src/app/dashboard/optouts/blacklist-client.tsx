'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Optout = {
  id: string
  phone_e164: string
  reason: string | null
  created_at: string
}

type Props = {
  optouts: Optout[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  searchQuery: string
  orgId: string
}

export function BlacklistClient({
  optouts,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  searchQuery,
  orgId,
}: Props) {
  const router = useRouter()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [showAdd, setShowAdd] = useState(false)
  const [addPhone, setAddPhone] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const navigateTo = (page: number, q?: string) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    const search = q ?? localSearch
    if (search) params.set('q', search)
    router.push(`/dashboard/optouts?${params.toString()}`)
  }

  const handleSearch = () => navigateTo(1)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleAdd = async () => {
    setAddError(null)
    const phones = addPhone
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)

    if (phones.length === 0) {
      setAddError('Saisissez au moins un numéro.')
      return
    }

    setAddLoading(true)
    try {
      const supabase = createClient()
      const rows = phones.map((phone) => ({
        org_id: orgId,
        phone_e164: phone.startsWith('+') ? phone : `+${phone}`,
        reason: 'Ajouté manuellement',
      }))

      const { error } = await supabase.from('optouts').upsert(rows, {
        onConflict: 'org_id,phone_e164',
      })

      if (error) throw error

      setAddPhone('')
      setShowAdd(false)
      router.refresh()
    } catch (err: any) {
      setAddError(err.message)
    }
    setAddLoading(false)
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('optouts')
        .delete()
        .in('id', Array.from(selected))

      if (error) throw error
      setSelected(new Set())
      router.refresh()
    } catch (_) {}
    setDeleting(false)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === optouts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(optouts.map((o) => o.id)))
    }
  }

  const pageNumbers = () => {
    const pages: number[] = []
    const start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Liste noire</h1>
        <p className="text-muted-foreground">
          <span className="font-semibold text-red-600">{totalCount}</span> numéro{totalCount > 1 ? 's' : ''} bloqué{totalCount > 1 ? 's' : ''}
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="font-semibold text-blue-900 mb-2">Comment ça fonctionne ?</p>
        <ul className="text-sm text-blue-700 space-y-1.5">
          <li>
            Les utilisateurs peuvent ajouter leur numéro à la liste noire en répondant <strong>&quot;STOP&quot;</strong> à votre message.
          </li>
          <li>
            Si vous utilisez des appareils partagés par l&apos;administrateur, ils doivent utiliser <strong>&quot;STOP {orgId.slice(0, 4).toUpperCase()}&quot;</strong> au lieu de &quot;STOP&quot; pour ajouter leur numéro.
          </li>
          <li>
            Les numéros en liste noire ne recevront plus aucun SMS de vos campagnes.
          </li>
        </ul>
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un numéro..."
            className="flex-1 px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition"
          >
            Rechercher
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition flex items-center gap-2"
          >
            <span>+</span> Ajouter
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <span>✕</span> Supprimer ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">Ajouter des numéros à la liste noire</h3>
          <textarea
            value={addPhone}
            onChange={(e) => setAddPhone(e.target.value)}
            rows={3}
            placeholder="Saisissez un ou plusieurs numéros (séparés par virgule, point-virgule ou retour à la ligne)&#10;Ex: +2250708090001, +33612345678"
            className="w-full px-4 py-3 border border-border rounded-lg bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
          />
          {addError && (
            <p className="text-sm text-red-600">{addError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addLoading}
              className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition disabled:opacity-50"
            >
              {addLoading ? 'Ajout...' : 'Confirmer'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(null) }}
              className="px-5 py-2 border border-border rounded-lg text-sm hover:bg-muted transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {optouts.length > 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-6 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">
              {totalCount} résultat{totalCount > 1 ? 's' : ''} — Page {currentPage}/{totalPages}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selected.size === optouts.length && optouts.length > 0}
                      onChange={toggleAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Numéro de mobile
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Raison
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {optouts.map((opt) => (
                  <tr key={opt.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(opt.id)}
                        onChange={() => toggleSelect(opt.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold">{opt.phone_e164}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {opt.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(opt.created_at).toLocaleDateString('fr-FR')} {new Date(opt.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          const supabase = createClient()
                          await supabase.from('optouts').delete().eq('id', opt.id)
                          router.refresh()
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Affichage {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, totalCount)} sur {totalCount}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => navigateTo(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Précédent
                </button>
                {pageNumbers().map((p) => (
                  <button
                    key={p}
                    onClick={() => navigateTo(p)}
                    className={`px-3 py-1.5 text-sm rounded-md transition ${
                      p === currentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => navigateTo(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-16 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
            <span className="text-5xl">🚫</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery ? 'Aucun résultat' : 'Aucun numéro en liste noire'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? `Aucun numéro ne correspond à "${searchQuery}"`
              : 'Tous vos contacts peuvent recevoir des SMS'}
          </p>
        </div>
      )}
    </div>
  )
}
