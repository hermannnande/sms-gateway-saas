import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APK_VERSION = '1.3.7-54'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const source = url.searchParams.get('source') || 'unknown'

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
  } catch (_) {}

  const target = new URL(`/app/sms-gateway.apk?v=${APK_VERSION}`, url.origin)
  const res = NextResponse.redirect(target, { status: 302 })
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  return res
}


