import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewCampaignForm } from './new-campaign-form'

export default async function NewCampaignPage() {
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

  // Mode développement : pas de redirection
  // if (!orgMember) {
  //   redirect('/onboarding')
  // }

  // Get templates
  const { data: templates } = orgMember ? await supabase
    .from('templates')
    .select('*')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false }) : { data: [] }

  // Get contacts count
  const { count: contactsCount } = orgMember ? await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgMember.org_id)
    .eq('opt_in', true) : { count: 0 }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-5xl">🚀</span>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Nouvelle campagne SMS
            </h1>
          </div>
          <p className="text-muted-foreground ml-[60px]">
            Créez et lancez votre campagne d'envoi de SMS en quelques clics
          </p>
        </div>
        <a
          href="/dashboard/campaigns"
          className="flex items-center gap-2 px-4 py-2.5 text-sm border-2 border-border rounded-lg hover:bg-muted transition font-semibold"
        >
          ← Retour
        </a>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto">
        <NewCampaignForm
          templates={templates || []}
          contactsCount={contactsCount || 0}
        />
      </div>
    </div>
  )
}


