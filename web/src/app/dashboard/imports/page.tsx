import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatFileSize } from '@/lib/campaign-imports'
import { ImportsList } from './imports-list'

export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
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

  const { data: files, error: filesError } = orgMember
    ? await supabase
        .from('campaign_import_files')
        .select('*, campaigns(name, status)')
        .eq('org_id', orgMember.org_id)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [], error: null }

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
          <p className="text-3xl font-semibold">{rows.length}</p>
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
          <p className="text-xs text-muted-foreground mt-1">Numéros valides importés</p>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Espace
            </p>
            <span className="text-2xl opacity-60">💾</span>
          </div>
          <p className="text-3xl font-semibold">{formatFileSize(totalBytes)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total stocké</p>
        </div>
      </div>

      {filesError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          <p className="font-semibold">Erreur de chargement des fichiers importés</p>
          <p className="mt-1">{filesError.message}</p>
          <p className="mt-2 text-xs">
            Si l&apos;erreur mentionne une table absente, la migration{' '}
            <code className="bg-red-100 px-1 rounded">
              20260919140000_campaign_import_files.sql
            </code>{' '}
            n&apos;a pas encore été appliquée.
          </p>
        </div>
      )}

      <ImportsList files={rows} />
    </div>
  )
}
