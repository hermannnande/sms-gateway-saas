import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/admin/guard-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const adminRole = await requireAdminApi(req)
    if (!adminRole) {
      return NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 })
    }

    const url = new URL(req.url)
    const emailRaw = (url.searchParams.get('email') || '').trim().toLowerCase()
    if (!emailRaw) {
      return NextResponse.json({ ok: false, error: 'email requis' }, { status: 400 })
    }

    // 1) Trouver l'utilisateur via RPC admin_list_users (lit auth.users via SECURITY DEFINER)
    const supabase = await createClient()
    const { data: list, error: listError } = await supabase.rpc('admin_list_users', {
      p_search: emailRaw,
      p_status: 'all',
      p_page: 0,
      p_page_size: 10,
    })

    if (listError) {
      const msg = listError.message?.includes('admin_only') ? 'Accès refusé' : listError.message
      return NextResponse.json({ ok: false, error: msg }, { status: 403 })
    }

    const items: any[] = (list?.items || list?.data?.items || []) as any[]
    const user = items.find((u) => (u?.email || '').toLowerCase() === emailRaw) || null

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: `Aucun compte trouvé pour : ${emailRaw}`,
          hint: `Invitez le client à créer un compte sur : https://smsenvoie.com/auth/register`,
        },
        { status: 404 }
      )
    }

    const userId = user.user_id || user.id
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'user_id manquant' }, { status: 500 })
    }

    // 2) Récupérer org + subscription + stats via service role (bypass RLS)
    const service = createServiceClient()

    const { data: member } = await service
      .from('org_members')
      .select('org_id, organizations(id, name)')
      .eq('user_id', userId)
      .maybeSingle()

    if (!member?.org_id) {
      return NextResponse.json(
        {
          ok: true,
          needsOrg: true,
          warning: `Compte trouvé (${emailRaw}) mais aucune organisation associée.`,
          hint: `Vous pouvez corriger ça en 1 clic: créer une organisation et rattacher ce compte.`,
          user: {
            user_id: userId,
            email: user.email,
            created_at: user.created_at,
          },
          org: null,
          org_id: null,
          currentSubscription: null,
          devicesCount: 0,
          messagesSentThisMonth: 0,
        },
        { status: 200 }
      )
    }

    const orgId = member.org_id

    const [{ count: devicesCount }, { count: messagesSentThisMonth }] = await Promise.all([
      service.from('devices').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
      service
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'sent')
        .gte('sent_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])

    const { data: currentSubscription } = await service
      .from('subscriptions')
      .select('id, status, plan_id, current_period_start, current_period_end, provider, plans(id, name, price_xof, max_devices, sms_quota_month)')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json(
      {
        ok: true,
        user: {
          user_id: userId,
          email: user.email,
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at,
          last_sign_in_at: user.last_sign_in_at,
        },
        org: member.organizations,
        org_id: orgId,
        currentSubscription,
        devicesCount: devicesCount || 0,
        messagesSentThisMonth: messagesSentThisMonth || 0,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    console.error('admin/find-user error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}


