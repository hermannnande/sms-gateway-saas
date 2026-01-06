'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // 1. Create user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Erreur lors de la création du compte')
      setLoading(false)
      return
    }

    // Ensure we have a session (required for RLS policies on org_members)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        // Si "Confirm sign up" est activé, il n'y aura pas de session tant que l'email n'est pas confirmé.
        setError(
          "✅ Compte créé. Veuillez vérifier votre email et confirmer l'inscription, puis revenez vous connecter."
        )
        setLoading(false)
        router.push('/auth/login')
        return
      }
    }

    // L'organisation est créée automatiquement côté DB (trigger sur auth.users).
    router.push('/onboarding')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border-2 border-destructive/50 text-destructive text-sm p-4 rounded-xl font-medium animate-fade-in">
          {error}
        </div>
      )}
      
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wide">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-5 py-3 border-3 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all text-lg bg-background"
          placeholder="vous@exemple.com"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-bold uppercase tracking-wide">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-5 py-3 border-3 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all text-lg bg-background"
          placeholder="••••••••"
          required
          minLength={6}
        />
        <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-primary text-white py-4 rounded-xl font-bold text-lg shadow-brutal-primary border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide group"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Création...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            ✨ Créer mon compte
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </span>
        )}
      </button>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Déjà un compte ?{' '}
        <a href="/auth/login" className="text-primary hover:text-primary/80 font-bold underline underline-offset-4 transition">
          Se connecter
        </a>
      </p>
    </form>
  )
}


