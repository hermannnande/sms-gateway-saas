import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessagesInbox } from './messages-inbox'

const PAGE_SIZE = 50

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!orgMember) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Aucune organisation trouvée.
      </div>
    )
  }

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const statusFilter = params.status || 'all'
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('messages')
    .select('*, campaigns(name)', { count: 'exact' })
    .eq('org_id', orgMember.org_id)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: messages, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data: devices } = await supabase
    .from('devices')
    .select('id, name')
    .eq('org_id', orgMember.org_id)

  // Counts per status
  const statusCounts: Record<string, number> = {}
  for (const s of ['queued', 'sent', 'delivered', 'failed']) {
    const { count: c } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)
      .eq('status', s)
    statusCounts[s] = c ?? 0
  }
  const { count: totalAll } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgMember.org_id)
  statusCounts['all'] = totalAll ?? 0

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Messages
        </h1>
        <p className="text-muted-foreground">
          Gérez et suivez tous vos messages SMS en temps réel
        </p>
      </div>

      <MessagesInbox
        messages={messages || []}
        devices={devices || []}
        currentPage={page}
        totalPages={totalPages}
        totalCount={count ?? 0}
        pageSize={PAGE_SIZE}
        statusFilter={statusFilter}
        statusCounts={statusCounts}
      />
    </div>
  )
}
