import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's org (avoid `.single()` which breaks when user has 0 or >1 memberships)
  const { data: orgMembers } = await supabase
    .from('org_members')
    .select('org_id, created_at, organizations(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  let orgName = orgMembers?.[0]?.organizations?.name ?? null

  // Auto-heal: if no org found (e.g. signup without autoconfirm), create a default org + membership
  if (!orgMembers || orgMembers.length === 0) {
    const orgId = crypto.randomUUID()
    await supabase.from('organizations').insert({ id: orgId, name: 'Mon organisation' })
    await supabase.from('org_members').insert({ org_id: orgId, user_id: user.id, role: 'ORG_ADMIN' })
    orgName = 'Mon organisation'
  }

  // Get user profile/settings if exists (can be extended later)
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Mon Profil
          </h1>
          <p className="text-muted-foreground">
            Gérez vos informations personnelles et vos préférences
          </p>
        </div>
      </div>

      {/* Profile form */}
      <ProfileForm 
        user={user}
        orgName={orgName || 'N/A'}
        userSettings={userSettings}
      />
    </div>
  )
}



