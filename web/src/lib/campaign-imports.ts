import type { SupabaseClient } from '@supabase/supabase-js'

/** Bucket privé créé par la migration 20260919140000_campaign_import_files.sql */
export const CAMPAIGN_IMPORTS_BUCKET = 'campaign-imports'

/** Aligné sur file_size_limit du bucket. */
export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024

export const ACCEPTED_IMPORT_EXTENSIONS = ['csv', 'txt', 'xls', 'xlsx'] as const

export type CampaignImportFile = {
  id: string
  campaign_id: string | null
  campaign_name: string | null
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  contact_count: number
  invalid_count: number
  created_at: string
}

/**
 * Supabase Storage n'accepte qu'un jeu restreint de caractères dans une clef.
 * On garde le nom d'origine en base (`file_name`) et on ne nettoie que le
 * chemin, pour que le téléchargement restitue le nom choisi par l'utilisateur.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
  return cleaned.slice(-120) || 'import'
}

export function buildImportStoragePath(
  orgId: string,
  campaignId: string | null,
  fileName: string,
): string {
  const folder = campaignId ?? 'sans-campagne'
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${orgId}/${folder}/${unique}-${sanitizeFileName(fileName)}`
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function isAcceptedImportFile(fileName: string): boolean {
  return (ACCEPTED_IMPORT_EXTENSIONS as readonly string[]).includes(
    getFileExtension(fileName),
  )
}

/**
 * Archive le fichier d'origine puis enregistre ses métadonnées.
 * Lève une erreur explicite en cas d'échec : l'appelant décide si c'est bloquant.
 */
export async function archiveCampaignImportFile(
  supabase: SupabaseClient,
  params: {
    file: File
    orgId: string
    campaignId: string | null
    campaignName: string | null
    uploadedBy: string | null
    contactCount: number
    invalidCount: number
  },
): Promise<void> {
  const { file, orgId, campaignId, campaignName, uploadedBy } = params

  if (!isAcceptedImportFile(file.name) || file.size === 0) {
    throw new Error('Choisissez un fichier CSV, TXT, XLS ou XLSX non vide.')
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(
      `Fichier trop volumineux pour l'archivage (${formatFileSize(file.size)}, maximum ${formatFileSize(MAX_IMPORT_FILE_BYTES)}).`,
    )
  }

  const storagePath = buildImportStoragePath(orgId, campaignId, file.name)

  const { error: uploadError } = await supabase.storage
    .from(CAMPAIGN_IMPORTS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { error: insertError } = await supabase
    .from('campaign_import_files')
    .insert({
      org_id: orgId,
      campaign_id: campaignId,
      campaign_name: campaignName,
      uploaded_by: uploadedBy,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      contact_count: params.contactCount,
      invalid_count: params.invalidCount,
    })

  if (insertError) {
    // Pas de ligne en base = fichier invisible et impossible à supprimer via
    // l'interface. On retire l'objet pour ne pas laisser d'orphelin.
    await supabase.storage.from(CAMPAIGN_IMPORTS_BUCKET).remove([storagePath])
    throw insertError
  }
}

/**
 * Télécharge le fichier sous son nom d'origine.
 * On passe par un blob plutôt qu'un lien signé : le bucket est privé et le nom
 * stocké dans le chemin est une version nettoyée, pas celui de l'utilisateur.
 */
export async function downloadCampaignImportFile(
  supabase: SupabaseClient,
  file: Pick<CampaignImportFile, 'storage_path' | 'file_name'>,
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(CAMPAIGN_IMPORTS_BUCKET)
    .download(file.storage_path)

  if (error) throw error
  if (!data) throw new Error('Fichier introuvable dans le stockage.')

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = file.file_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Let the browser start reading the blob before releasing it (mobile Safari).
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Supprime le binaire puis la ligne. L'ordre évite de perdre la trace d'un objet. */
export async function deleteCampaignImportFiles(
  supabase: SupabaseClient,
  files: Pick<CampaignImportFile, 'id' | 'storage_path'>[],
): Promise<void> {
  if (files.length === 0) return

  const { error: storageError } = await supabase.storage
    .from(CAMPAIGN_IMPORTS_BUCKET)
    .remove(files.map((f) => f.storage_path))

  if (storageError) throw storageError

  const { error: deleteError } = await supabase
    .from('campaign_import_files')
    .delete()
    .in(
      'id',
      files.map((f) => f.id),
    )

  if (deleteError) throw deleteError
}
