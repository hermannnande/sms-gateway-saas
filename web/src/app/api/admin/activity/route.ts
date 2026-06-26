import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const adminRole = await requireAdminApi(req)
  if (!adminRole) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '50')))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'))
  const type = url.searchParams.get('type') || 'all'

  const supabase = await createClient()

  try {
    const activities: ActivityItem[] = []

    const [usersRes, devicesRes, campaignsRes, eventsRes] = await Promise.all([
      type === 'all' || type === 'signup'
        ? supabase
            .from('app_users')
            .select('user_id, email, created_at')
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),

      type === 'all' || type === 'device'
        ? supabase
            .from('devices')
            .select('id, name, created_at, last_seen_at, status, app_version, org_id')
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),

      type === 'all' || type === 'campaign'
        ? supabase
            .from('campaigns')
            .select('id, name, status, created_at, total_count, sent_count, org_id')
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),

      type === 'all' || type === 'download'
        ? supabase
            .from('analytics_events')
            .select('id, event_type, meta, occurred_at')
            .eq('event_type', 'apk_download')
            .order('occurred_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (usersRes.data) {
      for (const u of usersRes.data) {
        activities.push({
          id: `signup-${u.user_id}`,
          type: 'signup',
          title: 'Nouvelle inscription',
          description: u.email || 'Utilisateur inconnu',
          timestamp: u.created_at,
          icon: 'user-plus',
          color: 'blue',
        })
      }
    }

    if (devicesRes.data) {
      for (const d of devicesRes.data) {
        activities.push({
          id: `device-${d.id}`,
          type: 'device',
          title: 'Appareil connecte',
          description: `${d.name || 'Appareil'} ${d.app_version ? `(v${d.app_version})` : ''}`,
          timestamp: d.created_at,
          icon: 'smartphone',
          color: 'emerald',
          meta: {
            status: d.status,
            lastSeen: d.last_seen_at,
            version: d.app_version,
          },
        })
      }
    }

    if (campaignsRes.data) {
      for (const c of campaignsRes.data) {
        activities.push({
          id: `campaign-${c.id}`,
          type: 'campaign',
          title: `Campagne "${c.name || 'Sans nom'}"`,
          description: `${c.sent_count || 0}/${c.total_count || 0} SMS - ${statusLabel(c.status)}`,
          timestamp: c.created_at,
          icon: 'megaphone',
          color: statusColor(c.status),
          meta: { status: c.status },
        })
      }
    }

    if (eventsRes.data) {
      for (const e of eventsRes.data) {
        const meta = e.meta || {}
        activities.push({
          id: `download-${e.id}`,
          type: 'download',
          title: 'Telechargement APK',
          description: meta.source || meta.user_agent?.substring(0, 60) || 'Telechargement',
          timestamp: e.occurred_at,
          icon: 'download',
          color: 'purple',
        })
      }
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const paged = activities.slice(offset, offset + limit)

    const countsByType = {
      signup: activities.filter((a) => a.type === 'signup').length,
      device: activities.filter((a) => a.type === 'device').length,
      campaign: activities.filter((a) => a.type === 'campaign').length,
      download: activities.filter((a) => a.type === 'download').length,
    }

    return NextResponse.json(
      { ok: true, items: paged, total: activities.length, counts: countsByType },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
  meta?: Record<string, any>
}

function statusLabel(s: string | null) {
  switch (s) {
    case 'running': return 'En cours'
    case 'paused': return 'En pause'
    case 'completed': return 'Terminee'
    case 'canceled': return 'Annulee'
    case 'queued': return 'En attente'
    default: return s || '-'
  }
}

function statusColor(s: string | null) {
  switch (s) {
    case 'running': return 'emerald'
    case 'completed': return 'gray'
    case 'canceled': return 'red'
    default: return 'orange'
  }
}
