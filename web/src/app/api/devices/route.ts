import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DeleteDevicesBody = {
  ids?: unknown
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 })
  }

  let body: DeleteDevicesBody
  try {
    body = (await request.json()) as DeleteDevicesBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Requête invalide' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id): id is string => typeof id === 'string'))]
    : []

  if (ids.length === 0 || ids.length > 100 || ids.some((id) => !UUID_PATTERN.test(id))) {
    return NextResponse.json({ ok: false, error: 'Identifiants d’appareil invalides' }, { status: 400 })
  }

  // Autorisation avec la session du navigateur : seuls les appareils d'une
  // organisation dont l'utilisateur est membre peuvent être supprimés.
  const { data: memberships, error: membershipError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)

  if (membershipError) {
    return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 })
  }

  const orgIds = (memberships ?? []).map((membership) => membership.org_id)
  if (orgIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'Aucune organisation trouvée' }, { status: 403 })
  }

  const { data: ownedDevices, error: lookupError } = await supabase
    .from('devices')
    .select('id')
    .in('id', ids)
    .in('org_id', orgIds)

  if (lookupError) {
    return NextResponse.json({ ok: false, error: lookupError.message }, { status: 500 })
  }

  const ownedIds = (ownedDevices ?? []).map((device) => device.id)
  if (ownedIds.length !== ids.length) {
    return NextResponse.json(
      { ok: false, error: 'Appareil introuvable ou accès refusé' },
      { status: 404 },
    )
  }

  try {
    // La clé serveur contourne uniquement le RLS après la vérification
    // d'appartenance ci-dessus. Les contraintes ON DELETE de la base restent actives.
    const service = createServiceClient()
    const { data: deletedDevices, error: deleteError } = await service
      .from('devices')
      .delete()
      .in('id', ownedIds)
      .select('id')

    if (deleteError) {
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 409 })
    }

    if ((deletedDevices ?? []).length !== ownedIds.length) {
      return NextResponse.json(
        { ok: false, error: 'La suppression n’a pas été confirmée par la base de données' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { ok: true, deleted: ownedIds },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur inconnue'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
