import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_SELECTED_IDS = 500

type DeleteRequest =
  | { scope: 'selected'; ids?: unknown }
  | { scope: 'all_queued' }

/**
 * DELETE /api/messages/pending
 *
 * Supprime uniquement des messages encore en statut `queued` dans
 * l'organisation de l'utilisateur connecté. Un SMS déjà récupéré par le
 * téléphone (`sending`) n'est jamais supprimé afin d'éviter un état ambigu.
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 })
    }

    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ ok: false, error: 'Organisation introuvable' }, { status: 404 })
    }

    const body = await req.json().catch(() => null) as DeleteRequest | null
    if (!body || !['selected', 'all_queued'].includes(body.scope)) {
      return NextResponse.json({ ok: false, error: 'Requête invalide' }, { status: 400 })
    }

    let selectedIds: string[] | null = null
    if (body.scope === 'selected') {
      if (!Array.isArray(body.ids)) {
        return NextResponse.json({ ok: false, error: 'Liste de messages invalide' }, { status: 400 })
      }
      selectedIds = [...new Set(
        body.ids.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
      )]
      if (selectedIds.length === 0 || selectedIds.length > MAX_SELECTED_IDS) {
        return NextResponse.json(
          { ok: false, error: `Sélection invalide (maximum ${MAX_SELECTED_IDS} messages)` },
          { status: 400 },
        )
      }
    }

    const service = createServiceClient()
    const { data, error } = await service.rpc('delete_queued_messages', {
      p_org_id: orgMember.org_id,
      p_message_ids: selectedIds,
    })
    if (error) throw error

    const result = Array.isArray(data) ? data[0] : data
    const deletedCount = Number(result?.deleted_count || 0)
    const skippedCount = Number(result?.skipped_count || 0)
    return NextResponse.json({
      ok: true,
      deleted: deletedCount,
      not_deleted: skippedCount,
    })
  } catch (error) {
    console.error('[messages/pending] Suppression impossible :', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Suppression impossible' },
      { status: 500 },
    )
  }
}
