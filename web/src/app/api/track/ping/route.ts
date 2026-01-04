import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Log server-side
  try {
    const service = createServiceClient()
    await service.from('analytics_events').insert({
      event_type: 'web_ping',
      platform: 'web',
      user_id: user.id,
      meta: {},
    })

    // Update app_users activity timestamps
    await service
      .from('app_users')
      .update({ last_web_seen_at: new Date().toISOString(), last_login_at: new Date().toISOString() })
      .eq('user_id', user.id)
  } catch (_) {}

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}


