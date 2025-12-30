import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactsList } from './contacts-list'
import { ImportContactsButton } from './import-contacts-button'

export default async function ContactsPage() {
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

  // Get contacts
  const { data: contacts } = orgMember ? await supabase
    .from('contacts')
    .select('*')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false }) : { data: [] }

  const optInCount = contacts?.filter(c => c.opt_in).length || 0

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Contacts
          </h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{contacts?.length || 0}</span> contact{(contacts?.length || 0) > 1 ? 's' : ''} dont <span className="font-semibold text-secondary">{optInCount}</span> opt-in
          </p>
        </div>
        <ImportContactsButton />
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
        <div className="text-4xl">💡</div>
        <div>
          <p className="font-semibold text-blue-900 mb-1">Importez vos contacts facilement</p>
          <p className="text-sm text-blue-700">
            Formats acceptés : CSV, Excel (XLS, XLSX) • Colonnes : phone, name, email (optionnels)
          </p>
        </div>
      </div>

      {/* Contacts list */}
      <ContactsList contacts={contacts || []} />
    </div>
  )
}
