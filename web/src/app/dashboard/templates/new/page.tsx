import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewTemplateForm } from './new-template-form'

export default async function NewTemplatePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <a href="/dashboard" className="text-xl font-bold text-primary">
            SMS Gateway
          </a>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Nouveau template</h1>
          <p className="text-muted-foreground">
            Créez un modèle de message réutilisable
          </p>
        </div>

        <NewTemplateForm />
      </main>
    </div>
  )
}




