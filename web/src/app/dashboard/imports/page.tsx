import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatFileSize } from '@/lib/campaign-imports'
import { ImportsList } from './imports-list'

export const dynamic = 'force-dynamic'

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams
  const pageNumber = Math.max(1, Math.min(100000, Number.parseInt(query.page ?? '1', 10) || 1))
  const pageSize = 50
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  const { data: files, error: filesError, count } = orgMember
    ? await supabase
        .from('campaign_import_files')
        .select('*, campaigns(name, status)', { count: 'exact' })
        .eq('org_id', orgMember.org_id)
        .order('created_at', { ascending: false })
        .range((pageNumber - 1) * pageSize, pageNumber * pageSize - 1)
    : { data: [], error: null, count: 0 }

  const rows = files ?? []
  const totalBytes = rows.reduce((sum, f) => sum + (f.size_bytes || 0), 0)
  const totalContacts = rows.reduce((sum, f) => sum + (f.contact_count || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-1">Fichiers importés</h1>
          <p className="text-sm text-muted-foreground">
            Les fichiers de contacts utilisés lors de vos envois, à retélécharger ou à supprimer
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fichiers
            </p>
            <span className="text-2xl opacity-60">📂</span>
          </div>
          <p className="text-3xl font-semibold">{count ?? rows.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Conservés</p>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Contacts
            </p>
            <span className="text-2xl opacity-60">👥</span>
          </div>
          <p className="text-3xl font-semibold">{totalContacts.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-muted-foreground mt-1">Numéros valides sur cette page</p>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Espace
            </p>
            <span className="text-2xl opacity-60">💾</span>
          </div>
          <p className="text-3xl font-semibold">{formatFileSize(totalBytes)}</p>
          <p className="text-xs text-muted-foreground mt-1">Fichiers sur cette page</p>
        </div>
      </div>

      {filesError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          <p className="font-semibold">Erreur de chargement des fichiers importés</p>
          <p className="mt-1">{filesError.message}</p>

        </div>
      )}

      <ImportsList key={pageNumber} files={rows} />
      <nav className="flex items-center justify-between text-sm" aria-label="Pages des fichiers importés">
        {pageNumber > 1 ? <Link href={`/dashboard/imports?page=${pageNumber - 1}`}>← Précédent</Link> : <span />}
        <span>Page {pageNumber} · {count ?? 0} fichiers</span>
        {pageNumber * pageSize < (count ?? 0) ? <Link href={`/dashboard/imports?page=${pageNumber + 1}`}>Suivant →</Link> : <span />}
      </nav>
    </div>
  )
}
