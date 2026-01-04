'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Plan = {
  id: string
  name: string
  price_xof: number
  sms_quota_month: number
  max_devices: number
  rate_limit_per_min: number
  features?: string[] | null
  highlight?: boolean | null
}

export function PlansCard({ plan, isActive }: { plan: Plan; isActive: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllFeatures, setShowAllFeatures] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get session token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Non authentifié')
      }

      // Call Edge Function to create checkout
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/billing_create_checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan_id: plan.id }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur création checkout')
      }

      const data = await response.json()

      if (data.checkout_url) {
        // Redirect to Payfonte checkout
        window.location.href = data.checkout_url
      } else {
        throw new Error('checkout_url manquant')
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const isPaid = plan.price_xof > 0 && plan.id !== 'free'
  const isHighlighted = !!plan.highlight
  const isPro = isHighlighted || plan.name.toLowerCase().includes('pro') || plan.price_xof >= 15900
  const smsLabel = plan.sms_quota_month === 0 ? 'Illimité' : plan.sms_quota_month.toLocaleString('fr-FR')
  const priceLabel =
    plan.price_xof === 0
      ? 'Gratuit'
      : `${plan.price_xof.toLocaleString('fr-FR')} F CFA`

  const features = (plan.features || []).filter(Boolean)
  const visibleFeatures = showAllFeatures ? features : features.slice(0, 6)

  return (
    <div 
      className={`glass-card rounded-3xl p-8 border-4 transition-all duration-300 ${
        isActive 
          ? 'border-primary/50 bg-primary/5 shadow-brutal-primary' 
          : isHighlighted
          ? 'border-accent/30 hover:border-accent hover-lift hover:shadow-brutal-accent'
          : 'border-black/10 dark:border-white/10 hover-lift'
      }`}
    >
      {/* Badge */}
      {isActive ? (
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold border-3 border-black dark:border-white shadow-brutal-sm">
            <span>⭐</span> Plan actuel
          </span>
        </div>
      ) : isHighlighted && (
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-2 bg-gradient-accent text-white px-4 py-2 rounded-xl text-sm font-bold border-3 border-black dark:border-white shadow-brutal-sm">
            <span>🚀</span> Populaire
          </span>
        </div>
      )}
      
      {/* Plan name */}
      <h3 className="text-3xl font-black text-center mb-6 gradient-text">
        {plan.name}
      </h3>
      
      {/* Price */}
      <div className="text-center mb-8">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-black text-primary">
            {priceLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          {plan.price_xof === 0 ? 'Plan de démarrage' : '/ mois'}
        </p>
      </div>

      {/* Features */}
      <ul className="space-y-4 mb-8">
        <li className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border-2 border-border">
          <span className="text-2xl">📨</span>
          <div>
            <p className="font-bold">
              {smsLabel} SMS
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.sms_quota_month === 0 ? 'sans limite' : 'par mois'}
            </p>
          </div>
        </li>
        <li className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border-2 border-border">
          <span className="text-2xl">📱</span>
          <div>
            <p className="font-bold">{plan.max_devices} appareil{plan.max_devices > 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">maximum</p>
          </div>
        </li>
      </ul>

      {features.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
            Fonctionnalités incluses
          </p>
          <ul className="space-y-2">
            {visibleFeatures.map((f, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-primary">✓</span>
                <span className="text-foreground">{f}</span>
              </li>
            ))}
          </ul>
          {features.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllFeatures(!showAllFeatures)}
              className="mt-3 text-sm font-bold text-primary hover:underline"
            >
              {showAllFeatures ? 'Voir moins' : 'Voir tout'}
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Certaines fonctionnalités seront activées progressivement.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border-2 border-destructive/50 text-destructive text-sm rounded-xl font-medium animate-fade-in">
          {error}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={handleSubscribe}
        disabled={loading || isActive || !isPaid}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 ${
          isActive
            ? 'bg-muted text-muted-foreground cursor-not-allowed border-3 border-border'
            : !isPaid
            ? 'bg-muted text-muted-foreground cursor-not-allowed border-3 border-border'
            : isPro
            ? 'bg-gradient-accent text-white shadow-brutal-accent border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none'
            : 'bg-gradient-primary text-white shadow-brutal-primary border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none'
        }`}
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span> Chargement...
          </>
        ) : isActive ? (
          <>
            <span>✓</span> Actif
          </>
        ) : !isPaid ? (
          <>
            <span>✓</span> Inclus
          </>
        ) : (
          <>
            <span>🚀</span> Souscrire maintenant
          </>
        )}
      </button>
    </div>
  )
}


