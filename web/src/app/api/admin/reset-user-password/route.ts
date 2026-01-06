import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/guard-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Vérifier que l'utilisateur est admin
  const adminCheck = await requireAdminApi(req)
  if (!adminCheck.ok) {
    return NextResponse.json({ ok: false, error: adminCheck.error }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { user_id, new_password } = body

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'user_id requis' }, { status: 400 })
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'new_password requis (min. 6 caractères)' },
        { status: 400 }
      )
    }

    // Utiliser l'API Admin de Supabase pour changer le mot de passe
    const supabase = await createClient()
    
    // Supabase Admin API: updateUserById
    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      password: new_password,
    })

    if (error) {
      console.error('Error resetting password:', error)
      return NextResponse.json(
        { ok: false, error: error.message || 'Erreur lors de la réinitialisation du mot de passe' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Mot de passe modifié avec succès pour ${data.user.email}`,
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error('Error in reset-user-password:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}

