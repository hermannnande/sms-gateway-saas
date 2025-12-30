import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplatesList } from './templates-list'

export default async function TemplatesPage() {
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

  // Get templates
  const { data: templates } = orgMember ? await supabase
    .from('templates')
    .select('*')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false }) : { data: [] }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Templates SMS
          </h1>
          <p className="text-muted-foreground">
            Créez et gérez vos modèles de messages réutilisables
          </p>
        </div>
        <a
          href="/dashboard/templates/new"
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-sm hover:shadow-md"
        >
          <span className="text-xl">➕</span>
          Nouveau template
        </a>
      </div>

      {/* Templates list */}
      <TemplatesList templates={templates || []} />
    </div>
  )
}
