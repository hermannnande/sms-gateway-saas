import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function handleLogout(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const url = new URL('/auth/login', request.url)
  return NextResponse.redirect(url, { status: 303 })
}

export async function GET(request: Request) {
  // Supporte la déconnexion via lien <a href="/auth/logout"> (GET) pour éviter HTTP 405.
  return handleLogout(request)
}

export async function POST(request: Request) {
  return handleLogout(request)
}








