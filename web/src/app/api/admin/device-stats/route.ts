import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'devices'
  const days = Number(url.searchParams.get('days') || '30')

  const supabase = await createClient()

  try {
    switch (type) {
      case 'devices': {
        const { data, error } = await supabase.rpc('admin_device_stats', { p_days: days })
        if (error) throw error
        return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
      }

      case 'by_country': {
        const { data, error } = await supabase.rpc('admin_devices_by_country')
        if (error) throw error
        return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
      }

      case 'global': {
        const { data, error } = await supabase.rpc('admin_devices_global_stats')
        if (error) throw error
        return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
      }

      default:
        return NextResponse.json({ ok: false, error: 'Type invalide' }, { status: 400 })
    }
  } catch (error: any) {
    const msg = error.message?.includes('admin_only') ? 'Accès refusé' : error.message
    return NextResponse.json({ ok: false, error: msg }, { status: 403 })
  }
}

