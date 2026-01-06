import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/admin/guard-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function defaultOrgName(email: string) {
  const local = email.split('@')[0] || 'client'
  const safe = local.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'client'
  return `Organisation ${safe}`
}

export async function POST(req: Request) {
  try {
    const adminRole = await requireAdminApi(req)
    if (!adminRole) {
      return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const user_id = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const org_name = typeof body?.org_name === 'string' ? body.org_name.trim() : ''
    const org_id = typeof body?.org_id === 'string' ? body.org_id.trim() : ''

    if (!user_id) {
      return NextResponse.json({ ok: false, error: 'user_id requis' }, { status: 400 })
    }

    const service = createServiceClient()

    // Si déjà rattaché à une org, ne rien faire
    const { data: existing } = await service
      .from('org_members')
      .select('org_id, organizations(id, name)')
      .eq('user_id', user_id)
      .maybeSingle()

    if (existing?.org_id) {
      return NextResponse.json(
        {
          ok: true,
          message: 'Compte déjà rattaché à une organisation',
          org: existing.organizations,
          org_id: existing.org_id,
        },
        { status: 200 }
      )
    }

    // Mode: rattacher à une org existante
    if (org_id) {
      const { data: org, error: orgErr } = await service
        .from('organizations')
        .select('id, name')
        .eq('id', org_id)
        .single()

      if (orgErr || !org) {
        return NextResponse.json({ ok: false, error: 'Organisation introuvable (org_id invalide)' }, { status: 404 })
      }

      const { error: memberErr } = await service.from('org_members').insert({
        org_id: org.id,
        user_id,
        role: 'ORG_ADMIN',
      })

      if (memberErr) {
        // déjà rattaché (ou autre erreur)
        if (memberErr.code === '23505') {
          return NextResponse.json(
            { ok: true, message: 'Compte déjà rattaché (org_members existe déjà)', org, org_id: org.id },
            { status: 200 }
          )
        }
        throw memberErr
      }

      return NextResponse.json(
        { ok: true, message: 'Compte rattaché à une organisation existante', org, org_id: org.id },
        { status: 200 }
      )
    }

    // Créer l'organisation
    const name = org_name || (email ? defaultOrgName(email) : 'Organisation client')
    const { data: org, error: orgErr } = await service
      .from('organizations')
      .insert({ name })
      .select('id, name')
      .single()

    if (orgErr || !org) {
      throw orgErr || new Error("Impossible de créer l'organisation")
    }

    // Rattacher l'utilisateur comme ORG_ADMIN
    const { error: memberErr } = await service.from('org_members').insert({
      org_id: org.id,
      user_id,
      role: 'ORG_ADMIN',
    })

    if (memberErr) {
      // rollback best-effort: delete org
      try {
        await service.from('organizations').delete().eq('id', org.id)
      } catch (_) {}
      throw memberErr
    }

    // NOTE: Un trigger DB crée automatiquement un abonnement free sur organizations INSERT.
    return NextResponse.json(
      {
        ok: true,
        message: 'Organisation créée et compte rattaché',
        org,
        org_id: org.id,
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error('admin/ensure-user-org error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}


