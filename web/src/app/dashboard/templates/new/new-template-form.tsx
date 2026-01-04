'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NewTemplateForm() {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Get user's org_id
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setError('Non authentifié')
      setLoading(false)
      return
    }

    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userData.user.id)
      .single()

    if (!orgMember) {
      setError('Organisation introuvable')
      setLoading(false)
      return
    }

    // Create template
    const { error: insertError } = await supabase
      .from('templates')
      .insert({
        org_id: orgMember.org_id,
        name,
        body,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard/templates')
  }

  return (
    <div className="bg-card border border-border rounded-lg p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nom du template
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ex: Bienvenue nouveaux clients"
            required
          />
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-medium mb-2">
            Message
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
            placeholder="Bonjour {nom}, bienvenue chez..."
            required
          />
          <p className="text-xs text-muted-foreground mt-2">
            Utilisez des variables comme {'{nom}'}, {'{prenom}'} qui seront remplacées lors de l'envoi
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le template'}
          </button>
          <a
            href="/dashboard/templates"
            className="px-6 py-2 border border-border rounded-lg hover:bg-accent transition"
          >
            Annuler
          </a>
        </div>
      </form>
    </div>
  )
}








