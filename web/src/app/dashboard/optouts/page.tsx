import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BlacklistClient } from './blacklist-client'

const PAGE_SIZE = 20

export default async function OptoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const currentPage = parseInt(params.page || '1', 10)
  const searchQuery = params.q || ''

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
    return <div>Aucune organisation trouvée</div>
  }

  const orgId = orgMember.org_id

  let countQuery = supabase
    .from('optouts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (searchQuery) {
    countQuery = countQuery.ilike('phone_e164', `%${searchQuery}%`)
  }

  const { count: totalCount } = await countQuery

  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let dataQuery = supabase
    .from('optouts')
    .select('id, phone_e164, reason, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (searchQuery) {
    dataQuery = dataQuery.ilike('phone_e164', `%${searchQuery}%`)
  }

  const { data: optouts } = await dataQuery

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)

  return (
    <BlacklistClient
      optouts={optouts || []}
      totalCount={totalCount || 0}
      currentPage={currentPage}
      totalPages={totalPages}
      pageSize={PAGE_SIZE}
      searchQuery={searchQuery}
      orgId={orgId}
    />
  )
}
