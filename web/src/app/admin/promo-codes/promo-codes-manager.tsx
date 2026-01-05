'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type PromoCode = {
  id: string
  code: string
  plan_id: string
  duration_days: number
  max_uses: number
  current_uses: number
  created_at: string
  expires_at: string | null
  is_active: boolean
  notes: string | null
}

type Plan = {
  id: string
  name: string
  price_xof: number
}

export function PromoCodesManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [selectedPlan, setSelectedPlan] = useState('monthly_1')
  const [duration, setDuration] = useState(30)
  const [maxUses, setMaxUses] = useState(1)
  const [notes, setNotes] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const supabase = createClient()

      // Charger les plans
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, name, price_xof')
        .order('price_xof', { ascending: true })

      if (plansData) setPlans(plansData)

      // Charger les codes promo
      const { data: codesData } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (codesData) setPromoCodes(codesData)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  function generateCodeString(): string {
    const prefix = selectedPlan.toUpperCase().replace('MONTHLY_', '')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `SMS${prefix}-${random}`
  }

  async function handleGenerate() {
    setGenerating(true)
    setMessage(null)

    try {
      const code = generateCodeString()
      
      const response = await fetch('/api/admin/generate-promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          plan_id: selectedPlan,
          duration_days: duration,
          max_uses: maxUses,
          notes: notes.trim() || null,
          expires_in_days: expiresInDays,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur génération code')
      }

      setMessage({
        type: 'success',
        text: `✅ Code généré avec succès : ${code}`,
      })

      // Reset form
      setNotes('')
      setExpiresInDays(null)

      // Reload codes
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggleActive(codeId: string, currentActive: boolean) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !currentActive })
        .eq('id', codeId)

      if (error) throw error

      setMessage({
        type: 'success',
        text: !currentActive ? 'Code activé' : 'Code désactivé',
      })

      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Generate Form */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-xl font-bold mb-4">Générer un nouveau code promo</h2>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Plan */}
          <div>
            <label className="block text-sm font-medium mb-2">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {plan.price_xof.toLocaleString('fr-FR')} F CFA
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">Durée (jours)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={7}>7 jours (essai)</option>
              <option value={30}>30 jours (1 mois)</option>
              <option value={60}>60 jours (2 mois)</option>
              <option value={90}>90 jours (3 mois)</option>
              <option value={180}>180 jours (6 mois)</option>
              <option value={365}>365 jours (1 an)</option>
            </select>
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-sm font-medium mb-2">Utilisations max</label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
              min="1"
              max="1000"
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nombre de fois que ce code peut être utilisé
            </p>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium mb-2">Expire dans (jours)</label>
            <input
              type="number"
              value={expiresInDays || ''}
              onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Jamais (optionnel)"
              min="1"
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Laissez vide pour aucune expiration
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Notes (optionnel)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Code pour client VIP, Promo Black Friday..."
            className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Preview */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Aperçu du code :</p>
          <p className="text-2xl font-mono font-bold text-primary">{generateCodeString()}</p>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {generating ? 'Génération...' : '✨ Générer le code promo'}
        </button>
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

      {/* Codes List */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-xl font-bold mb-4">Codes promo existants ({promoCodes.length})</h2>
        
        {promoCodes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucun code promo généré pour le moment
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 px-2 font-semibold text-sm">Code</th>
                  <th className="pb-3 px-2 font-semibold text-sm">Plan</th>
                  <th className="pb-3 px-2 font-semibold text-sm">Durée</th>
                  <th className="pb-3 px-2 font-semibold text-sm">Utilisations</th>
                  <th className="pb-3 px-2 font-semibold text-sm">Expire</th>
                  <th className="pb-3 px-2 font-semibold text-sm">Statut</th>
                  <th className="pb-3 px-2 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((code) => (
                  <tr key={code.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <span className="font-mono font-bold text-primary">{code.code}</span>
                      {code.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{code.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-sm">
                      {plans.find((p) => p.id === code.plan_id)?.name || code.plan_id}
                    </td>
                    <td className="py-3 px-2 text-sm">{code.duration_days}j</td>
                    <td className="py-3 px-2 text-sm">
                      <span className={code.current_uses >= code.max_uses ? 'text-red-500 font-semibold' : ''}>
                        {code.current_uses} / {code.max_uses}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm">
                      {code.expires_at ? (
                        <span className={new Date(code.expires_at) < new Date() ? 'text-red-500' : ''}>
                          {new Date(code.expires_at).toLocaleDateString('fr-FR')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Jamais</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          code.is_active
                            ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {code.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => handleToggleActive(code.id, code.is_active)}
                        className="text-xs px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        {code.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <span>💡</span> Comment utiliser les codes promo
        </h3>
        <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
          <li>• <strong>Étape 1</strong> : Générez un code avec le plan et la durée souhaités</li>
          <li>• <strong>Étape 2</strong> : Copiez le code et envoyez-le au client via WhatsApp</li>
          <li>• <strong>Étape 3</strong> : Le client va dans son dashboard → section "Abonnement"</li>
          <li>• <strong>Étape 4</strong> : Il entre le code dans le champ "Code promo"</li>
          <li>• <strong>Étape 5</strong> : Son abonnement est activé instantanément ✅</li>
        </ul>
      </div>
    </div>
  )
}

