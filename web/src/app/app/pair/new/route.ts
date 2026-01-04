import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)

  const deviceNameRaw = (url.searchParams.get('device_name') ?? '').trim()
  const deviceName = deviceNameRaw || 'Mon téléphone'

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    return NextResponse.redirect(new URL('/auth/login', url))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    const fallback = new URL('/dashboard/devices', url)
    fallback.searchParams.set('pair_error', 'missing_env')
    return NextResponse.redirect(fallback)
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/device_pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ device_name: deviceName }),
    })

    if (!response.ok) {
      let errorMsg = 'Erreur création device'
      try {
        const err = await response.json()
        errorMsg = err?.error || err?.message || errorMsg
      } catch {
        // ignore
      }
      const fallback = new URL('/dashboard/devices', url)
      fallback.searchParams.set('pair_error', errorMsg)
      return NextResponse.redirect(fallback)
    }

    const data = await response.json()
    const deviceToken = typeof data?.device_token === 'string' ? data.device_token.trim() : ''

    if (!deviceToken) {
      const fallback = new URL('/dashboard/devices', url)
      fallback.searchParams.set('pair_error', 'device_token manquant')
      return NextResponse.redirect(fallback)
    }

    const nextUrl = new URL('/app/pair', url)
    nextUrl.searchParams.set('device_token', deviceToken)
    nextUrl.searchParams.set('device_name', deviceName)
    nextUrl.searchParams.set('source', 'one_click')
    return NextResponse.redirect(nextUrl)
  } catch (e: any) {
    const fallback = new URL('/dashboard/devices', url)
    fallback.searchParams.set('pair_error', e?.message || 'Erreur réseau')
    return NextResponse.redirect(fallback)
  }
}


