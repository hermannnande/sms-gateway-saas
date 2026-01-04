import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireAdminApi()
  if (!ctx.ok) return ctx.response

  const service = ctx.service

  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
  const last5m = new Date(now.getTime() - 5 * 60 * 1000)

  const [
    { count: usersTotal },
    { count: orgsTotal },
    { count: devicesTotal },
    { count: downloadsTotal },
    { count: downloadsToday },
    { count: downloadsMonth },
    { count: webActive5m },
    { count: smsSentToday },
    { count: smsSentMonth },
  ] = await Promise.all([
    service.from('app_users').select('*', { count: 'exact', head: true }),
    service.from('organizations').select('*', { count: 'exact', head: true }),
    service.from('devices').select('*', { count: 'exact', head: true }),
    service.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'apk_download'),
    service
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'apk_download')
      .gte('occurred_at', todayStart.toISOString()),
    service
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'apk_download')
      .gte('occurred_at', monthStart.toISOString()),
    service
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_type', 'web_ping')
      .gte('occurred_at', last5m.toISOString()),
    service
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', todayStart.toISOString()),
    service
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', monthStart.toISOString()),
  ])

  return NextResponse.json(
    {
      ok: true,
      users_total: usersTotal || 0,
      orgs_total: orgsTotal || 0,
      devices_total: devicesTotal || 0,
      downloads_total: downloadsTotal || 0,
      downloads_today: downloadsToday || 0,
      downloads_month: downloadsMonth || 0,
      web_active_5m: webActive5m || 0,
      sms_sent_today: smsSentToday || 0,
      sms_sent_month: smsSentMonth || 0,
      ts: now.toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}


