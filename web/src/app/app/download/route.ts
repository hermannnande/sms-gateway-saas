import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const source = url.searchParams.get('source') || 'unknown'

  // Log download event (server-side)
  try {
    const supabase = createServiceClient()
    await supabase.from('analytics_events').insert({
      event_type: 'apk_download',
      platform: 'web',
      meta: {
        source,
        user_agent: req.headers.get('user-agent') || null,
        referer: req.headers.get('referer') || null,
      },
    })
  } catch (_) {
    // non-bloquant: on ne bloque jamais le téléchargement si le tracking échoue
  }

  // Redirect to static file in /app/ folder
  const target = new URL('/app/sms-gateway.apk', url.origin)
  const res = NextResponse.redirect(target, { status: 302 })
  res.headers.set('Cache-Control', 'no-store')
  return res
}


