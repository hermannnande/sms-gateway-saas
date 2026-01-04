import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  return NextResponse.json(
    {
      ok: true,
      supabaseUrl: url,
      anonKeyPresent: Boolean(key),
      anonKeyLast6: key ? key.slice(-6) : null,
      nodeEnv: process.env.NODE_ENV ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}






