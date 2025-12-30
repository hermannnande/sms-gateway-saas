import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessagesInbox } from './messages-inbox'

export default async function MessagesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's org_id
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  // Get received messages (for SMS responses - future feature)
  // Pour l'instant, on affiche tous les messages envoyés
  const { data: messages } = orgMember ? await supabase
    .from('messages')
    .select('*, campaigns(name)')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false })
    .limit(500) : { data: [] }

  // Get devices for filter
  const { data: devices } = orgMember ? await supabase
    .from('devices')
    .select('id, name')
    .eq('org_id', orgMember.org_id) : { data: [] }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Messages
          </h1>
          <p className="text-muted-foreground">
            Gérez et suivez tous vos messages SMS en temps réel
          </p>
        </div>
      </div>

      {/* Messages inbox */}
      <MessagesInbox 
        messages={messages || []} 
        devices={devices || []}
      />
    </div>
  )
}

