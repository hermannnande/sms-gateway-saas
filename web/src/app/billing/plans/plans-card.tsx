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
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
            Authorization: `Bearer ${session.access_token}`,
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
  const smsLabel =
    plan.sms_quota_month === 0 ? 'Illimité' : plan.sms_quota_month.toLocaleString('fr-FR')

  const features = (plan.features || []).filter(Boolean)
  const visibleFeatures = showAllFeatures ? features : features.slice(0, 5)

  return (
    <div
      className={`relative rounded-xl border-2 p-6 transition-all duration-300 ${
        isActive
          ? 'border-primary bg-primary/5 shadow-lg scale-105'
          : isHighlighted
          ? 'border-primary/50 bg-gradient-to-b from-primary/5 to-transparent shadow-md hover:shadow-lg hover:scale-105'
          : 'border-border bg-card hover:border-border/80 hover:shadow-md'
      }`}
    >
      {/* Badge */}
      {isActive && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm">
            <span>✓</span> Plan actuel
          </span>
        </div>
      )}
      {!isActive && isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm">
            <span>⭐</span> Populaire
          </span>
        </div>
      )}

      {/* Plan Name */}
      <div className="text-center mb-6 mt-2">
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          {plan.price_xof === 0 ? (
            <span className="text-4xl font-bold">Gratuit</span>
          ) : (
            <>
              <span className="text-4xl font-bold">
                {plan.price_xof.toLocaleString('fr-FR')}
              </span>
              <span className="text-sm text-muted-foreground font-medium">F CFA / mois</span>
            </>
          )}
        </div>
      </div>

      {/* Key Features */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-xl">📨</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{smsLabel} SMS</p>
            <p className="text-xs text-muted-foreground">
              {plan.sms_quota_month === 0 ? 'Sans limite' : 'Par mois'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-xl">📱</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {plan.max_devices} appareil{plan.max_devices > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">Maximum</p>
          </div>
        </div>
      </div>

      {/* Features List */}
      {features.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Inclus :
          </p>
          <ul className="space-y-2">
            {visibleFeatures.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <svg
                  className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-foreground/80">{feature}</span>
              </li>
            ))}
          </ul>
          {features.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllFeatures(!showAllFeatures)}
              className="mt-3 text-xs font-semibold text-primary hover:underline"
            >
              {showAllFeatures ? '− Voir moins' : `+ Voir ${features.length - 5} autres`}
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={handleSubscribe}
        disabled={loading || isActive || !isPaid}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
          isActive
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : !isPaid
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : isHighlighted
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg'
            : 'bg-foreground text-background hover:bg-foreground/90'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Chargement...
          </span>
        ) : isActive ? (
          '✓ Plan actif'
        ) : !isPaid ? (
          '✓ Inclus'
        ) : (
          'Souscrire maintenant'
        )}
      </button>

      {/* Note for future features */}
      {features.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          Certaines fonctionnalités seront activées progressivement.
        </p>
      )}
    </div>
  )
}
