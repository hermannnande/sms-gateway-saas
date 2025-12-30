import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InboxList } from './inbox-list'

export default async function InboxPage() {
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

  // Get inbox messages
  const { data: messages } = orgMember ? await supabase
    .from('inbox_messages')
    .select('*, devices(name, device_token)')
    .eq('org_id', orgMember.org_id)
    .order('received_at', { ascending: false }) : { data: [] }

  // Get devices for filter
  const { data: devices } = orgMember ? await supabase
    .from('devices')
    .select('id, name')
    .eq('org_id', orgMember.org_id) : { data: [] }

  // Statistics
  const totalMessages = messages?.length || 0
  const unreadMessages = messages?.filter(m => !m.read).length || 0
  const starredMessages = messages?.filter(m => m.starred).length || 0
  const archivedMessages = messages?.filter(m => m.archived).length || 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-1">
            Boîte de réception SMS
          </h1>
          <p className="text-sm text-muted-foreground">
            Messages reçus de vos clients
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total
            </p>
            <span className="text-2xl opacity-60">📬</span>
          </div>
          <p className="text-3xl font-semibold">{totalMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">Messages reçus</p>
        </div>

        <div className="bg-card rounded-lg p-5 border border-primary/20 bg-primary/5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Non lus
            </p>
            <span className="text-2xl opacity-60">📩</span>
          </div>
          <p className="text-3xl font-semibold text-primary">{unreadMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">À traiter</p>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Favoris
            </p>
            <span className="text-2xl opacity-60">⭐</span>
          </div>
          <p className="text-3xl font-semibold text-yellow-600">{starredMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">Marqués important</p>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Archivés
            </p>
            <span className="text-2xl opacity-60">📦</span>
          </div>
          <p className="text-3xl font-semibold text-gray-600">{archivedMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">Messages traités</p>
        </div>
      </div>

      {/* Inbox list with filters */}
      <InboxList messages={messages || []} devices={devices || []} />
    </div>
  )
}

