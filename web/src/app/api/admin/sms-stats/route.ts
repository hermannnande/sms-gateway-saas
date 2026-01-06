import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'global'
  const days = Number(url.searchParams.get('days') || '30')
  const months = Number(url.searchParams.get('months') || '12')
  const limit = Number(url.searchParams.get('limit') || '10')

  const supabase = await createClient()

  try {
    switch (type) {
      case 'global': {
        const { data, error } = await supabase.rpc('admin_sms_global_stats')
        if (error) throw error
        return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
      }

      case 'by_day': {
        const { data, error } = await supabase.rpc('admin_sms_stats_by_day', { p_days: days })
        if (error) throw error
        return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
      }

      case 'by_month': {
        const { data, error } = await supabase.rpc('admin_sms_stats_by_month', { p_months: months })
        if (error) throw error
        return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
      }

      case 'top_orgs': {
        const { data, error } = await supabase.rpc('admin_top_orgs_by_sms', { p_limit: limit, p_days: days })
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

