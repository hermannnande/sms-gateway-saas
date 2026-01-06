'use client'

import { useState } from 'react'

type Plan = {
  id: string
  name: string
  price_xof: number
  sms_quota_month: number
  max_devices: number
}

type FindUserPayload = {
  ok: boolean
  error?: string
  hint?: string
  warning?: string
  needsOrg?: boolean
  user?: {
    user_id: string
    email: string
    created_at: string
    email_confirmed_at?: string | null
    last_sign_in_at?: string | null
  }
  org?: { id: string; name: string } | null
  org_id?: string
  currentSubscription?: any | null
  devicesCount?: number
  messagesSentThisMonth?: number
}

export function ActivateSubscriptionForm() {
  const [email, setEmail] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('monthly_1')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(false)
  const [creatingOrg, setCreatingOrg] = useState(false)
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
      const emailNorm = email.trim().toLowerCase()
      const res = await fetch(`/api/admin/find-user?email=${encodeURIComponent(emailNorm)}`, {
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => ({}))) as FindUserPayload

      if (!res.ok || !json?.ok) {
        const txt = [json?.error || `Erreur API (${res.status})`, json?.hint].filter(Boolean).join('\n\n')
        setMessage({ type: 'error', text: txt })
        return
      }

      if (!json.user) {
        setMessage({ type: 'error', text: 'Réponse invalide: user manquant' })
        return
      }

      setSearchResult({
        user: json.user,
        org: json.org || null,
        currentSubscription: json.currentSubscription,
        devicesCount: json.devicesCount || 0,
        messagesSentThisMonth: json.messagesSentThisMonth || 0,
        needsOrg: json.needsOrg === true,
      })
      if (json.needsOrg) {
        const txt = [json.warning || 'Compte trouvé mais org manquante.', json.hint].filter(Boolean).join('\n\n')
        setMessage({ type: 'error', text: txt })
      } else {
        setMessage({ type: 'success', text: '✅ Client trouvé avec succès !' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOrg() {
    if (!searchResult?.user?.user_id) return
    setCreatingOrg(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/ensure-user-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: searchResult.user.user_id,
          email: searchResult.user.email,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Erreur API (${res.status})`)
      }
      setMessage({ type: 'success', text: `✅ ${json.message || 'Organisation créée'}` })
      await handleSearch()
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setCreatingOrg(false)
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
          className={`p-4 rounded-lg border whitespace-pre-line ${
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
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📱</span>
                <span className="text-sm font-medium text-muted-foreground">Appareils</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{searchResult.devicesCount}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📨</span>
                <span className="text-sm font-medium text-muted-foreground">SMS ce mois</span>
              </div>
              <p className="text-3xl font-bold text-purple-600">{searchResult.messagesSentThisMonth}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⏱️</span>
                <span className="text-sm font-medium text-muted-foreground">Inscrit depuis</span>
              </div>
              <p className="text-lg font-bold text-amber-600">
                {Math.floor((Date.now() - new Date(searchResult.user.created_at).getTime()) / (1000 * 60 * 60 * 24))} jours
              </p>
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <span className="text-2xl">👤</span>
              <div className="flex-1">
                <p className="font-bold text-lg">{searchResult.user.email}</p>
                <p className="text-xs text-muted-foreground">
                  Compte créé le {new Date(searchResult.user.created_at).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })} à {new Date(searchResult.user.created_at).toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
              <a
                href={`mailto:${searchResult.user.email}`}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                📧 Email
              </a>
            </div>

            {searchResult.needsOrg ? (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                <span className="text-3xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-bold text-lg text-red-700 dark:text-red-400">Organisation manquante</p>
                  <p className="text-sm text-red-700/80 dark:text-red-400/80 mt-1">
                    Ce compte existe, mais il n&apos;est rattaché à aucune organisation. Sans organisation, on ne peut pas activer un abonnement.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCreateOrg}
                      disabled={creatingOrg}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingOrg ? 'Création...' : '🛠️ Créer organisation + rattacher'}
                    </button>
                    <a
                      href="/auth/register"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 font-semibold text-sm hover:bg-red-100/50 dark:hover:bg-red-950/30"
                    >
                      🔗 Lien inscription client
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                <span className="text-2xl">🏢</span>
                <div className="flex-1">
                  <p className="font-semibold">{searchResult.org?.name || 'Organisation'}</p>
                  <p className="text-xs text-muted-foreground font-mono">ID: {searchResult.org?.id}</p>
                </div>
              </div>
            )}

            {searchResult.currentSubscription ? (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-3xl">✅</span>
                <div className="flex-1">
                  <p className="font-bold text-lg text-green-700 dark:text-green-400">
                    {searchResult.currentSubscription.plans?.name}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <span className="px-2 py-1 bg-green-200/50 dark:bg-green-800/30 rounded">
                      💰 {searchResult.currentSubscription.plans?.price_xof?.toLocaleString('fr-FR')} F CFA/mois
                    </span>
                    <span className="px-2 py-1 bg-green-200/50 dark:bg-green-800/30 rounded">
                      📱 {searchResult.currentSubscription.plans?.max_devices} appareil(s)
                    </span>
                    <span className="px-2 py-1 bg-green-200/50 dark:bg-green-800/30 rounded">
                      📨 {searchResult.currentSubscription.plans?.sms_quota_month === 0 ? 'SMS illimités' : `${searchResult.currentSubscription.plans?.sms_quota_month} SMS/mois`}
                    </span>
                  </div>
                  {searchResult.currentSubscription.current_period_end && (
                    <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                      📅 Expire le {new Date(searchResult.currentSubscription.current_period_end).toLocaleDateString('fr-FR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <span className="text-3xl">🎁</span>
                <div className="flex-1">
                  <p className="font-bold text-lg text-orange-700 dark:text-orange-400">
                    Plan Gratuit
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                    100 SMS/mois • 1 appareil
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activate Subscription */}
      {searchResult && !searchResult.needsOrg && (
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

