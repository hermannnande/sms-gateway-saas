'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Plan = {
  id: string
  name: string
  price_xof: number
  sms_quota_month: number
  max_devices: number
}

export function ActivateSubscriptionForm() {
  const [email, setEmail] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('monthly_1')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchResult, setSearchResult] = useState<any>(null)

  const plans: Plan[] = [
    { id: 'monthly_1', name: 'Plan 1 appareil', price_xof: 9900, sms_quota_month: 0, max_devices: 1 },
    { id: 'monthly_3', name: 'Plan 3 appareils', price_xof: 15900, sms_quota_month: 0, max_devices: 3 },
    { id: 'monthly_5', name: 'Plan 5 appareils', price_xof: 22900, sms_quota_month: 0, max_devices: 5 },
  ]

  async function handleSearch() {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Veuillez entrer un email' })
      return
    }

    setLoading(true)
    setMessage(null)
    setSearchResult(null)

    try {
      const supabase = createClient()
      
      // Chercher l'utilisateur
      const { data: user } = await supabase
        .from('app_users')
        .select('id, email, created_at')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      if (!user) {
        setMessage({ type: 'error', text: 'Utilisateur non trouvé avec cet email' })
        setLoading(false)
        return
      }

      // Chercher son organisation
      const { data: member } = await supabase
        .from('org_members')
        .select('org_id, organizations(id, name)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!member) {
        setMessage({ type: 'error', text: 'Organisation non trouvée pour cet utilisateur' })
        setLoading(false)
        return
      }

      // Chercher son abonnement actuel
      const { data: currentSub } = await supabase
        .from('subscriptions')
        .select('*, plans(name)')
        .eq('org_id', member.org_id)
        .eq('status', 'active')
        .maybeSingle()

      setSearchResult({
        user,
        org: member.organizations,
        currentSubscription: currentSub,
      })
      setMessage({ type: 'success', text: 'Client trouvé !' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate() {
    if (!searchResult) return

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/activate-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: searchResult.org.id,
          plan_id: selectedPlan,
          duration_days: duration,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur activation')
      }

      setMessage({
        type: 'success',
        text: `✅ Abonnement activé avec succès ! (${plans.find(p => p.id === selectedPlan)?.name} pour ${duration} jours)`,
      })

      // Refresh search result
      await handleSearch()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search User */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-xl font-bold mb-4">1. Rechercher le client</h2>
        <div className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Email du client (ex: client@example.com)"
            className="flex-1 px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !email.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Search Result */}
      {searchResult && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold mb-4">Informations du client</h2>
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-2xl">👤</span>
              <div>
                <p className="font-semibold">{searchResult.user.email}</p>
                <p className="text-xs text-muted-foreground">
                  Inscrit le {new Date(searchResult.user.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-2xl">🏢</span>
              <div>
                <p className="font-semibold">{searchResult.org.name || 'Organisation'}</p>
                <p className="text-xs text-muted-foreground">ID: {searchResult.org.id}</p>
              </div>
            </div>
            {searchResult.currentSubscription && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-2xl">✓</span>
                <div className="flex-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Abonnement actif : {searchResult.currentSubscription.plans?.name}
                  </p>
                  {searchResult.currentSubscription.period_end && (
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Expire le {new Date(searchResult.currentSubscription.period_end).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activate Subscription */}
      {searchResult && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold mb-4">2. Activer/Renouveler l'abonnement</h2>
          
          {/* Plan Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Plan à activer</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {plan.price_xof.toLocaleString('fr-FR')} F CFA ({plan.max_devices} appareil
                  {plan.max_devices > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Duration Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Durée (en jours)</label>
            <div className="grid grid-cols-3 gap-3">
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setDuration(days)}
                  className={`px-4 py-3 rounded-lg border font-semibold transition-all ${
                    duration === days
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  {days} jours
                </button>
              ))}
            </div>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              min="1"
              max="365"
              className="w-full mt-3 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="Ou entrez un nombre de jours personnalisé"
            />
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2 text-sm">Résumé de l'activation</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Client : <strong className="text-foreground">{searchResult.user.email}</strong></li>
              <li>• Plan : <strong className="text-foreground">{plans.find(p => p.id === selectedPlan)?.name}</strong></li>
              <li>• Durée : <strong className="text-foreground">{duration} jours</strong></li>
              <li>• Fin prévue : <strong className="text-foreground">
                {new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
              </strong></li>
            </ul>
          </div>

          {/* Activate Button */}
          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? 'Activation en cours...' : '✅ Activer l\'abonnement maintenant'}
          </button>

          <p className="text-xs text-center text-muted-foreground mt-3">
            L'activation prendra effet immédiatement et le client recevra son quota complet.
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <span>💡</span> Instructions
        </h3>
        <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
          <li>• <strong>Étape 1</strong> : Le client vous contacte sur WhatsApp avec son email</li>
          <li>• <strong>Étape 2</strong> : Vous recherchez son email dans ce formulaire</li>
          <li>• <strong>Étape 3</strong> : Vous sélectionnez le plan payé et la durée</li>
          <li>• <strong>Étape 4</strong> : Vous cliquez sur "Activer l'abonnement"</li>
          <li>• <strong>Étape 5</strong> : Vous confirmez l'activation au client sur WhatsApp ✅</li>
        </ul>
      </div>
    </div>
  )
}

