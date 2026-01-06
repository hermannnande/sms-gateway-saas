import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const adminRole = await requireAdminApi(req)
  if (!adminRole) {
    return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

  const env = {
    NEXT_PUBLIC_SUPABASE_URL_present: Boolean(supabaseUrl),
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: Boolean(anonKey),
    SUPABASE_SERVICE_ROLE_KEY_present: Boolean(serviceKey),
  }

  // Validate service key by doing a harmless query
  try {
    const service = createServiceClient()
    const { error } = await service.from('plans').select('id', { count: 'exact', head: true }).limit(1)
    if (error) {
      const msg = error.message || 'Erreur Supabase'
      return NextResponse.json(
        {
          ok: true,
          adminRole,
          env,
          serviceKeyValid: false,
          error: msg,
          hint:
            msg.toLowerCase().includes('invalid api key')
              ? 'Clé invalide: vérifie SUPABASE_SERVICE_ROLE_KEY dans Vercel (Project Settings → Environment Variables) et copie la service_role key depuis Supabase → Settings → API.'
              : null,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { ok: true, adminRole, env, serviceKeyValid: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    const msg = e?.message || 'Erreur serveur'
    return NextResponse.json(
      {
        ok: true,
        adminRole,
        env,
        serviceKeyValid: false,
        error: msg,
        hint:
          msg.toLowerCase().includes('service_role') || msg.toLowerCase().includes('supabase_service')
            ? 'Variable manquante: ajoute SUPABASE_SERVICE_ROLE_KEY sur Vercel (server-only) avec la service_role key Supabase.'
            : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}


