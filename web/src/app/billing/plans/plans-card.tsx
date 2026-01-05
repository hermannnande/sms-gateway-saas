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

// Liens de paiement Moneroo directs
const MONEROO_PAYMENT_LINKS: Record<string, string> = {
  'monthly_1': 'https://pay.moneroo.io/plink_p61vil43wczd',  // 9,900 XOF - 1 appareil
  'monthly_3': 'https://pay.moneroo.io/plink_jdxmvt9qxqrl',  // 15,900 XOF - 3 appareils
  'monthly_5': 'https://pay.moneroo.io/plink_fstcasdzl6sh',  // 22,900 XOF - 5 appareils
}

export function PlansCard({ plan, isActive }: { plan: Plan; isActive: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllFeatures, setShowAllFeatures] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    try {
      // Si un lien Moneroo existe pour ce plan, l'utiliser directement
      const monerooLink = MONEROO_PAYMENT_LINKS[plan.id]
      if (monerooLink) {
        window.location.href = monerooLink
        return
      }

      // Sinon, utiliser l'ancien système Payfonte (fallback)
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

      {/* CTA Buttons */}
      <div className="space-y-3">
        {/* Primary CTA - Souscrire en ligne */}
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

        {/* WhatsApp CTA - Contact direct */}
        {isPaid && !isActive && (
          <a
            href={`https://wa.me/2250778030075?text=${encodeURIComponent(
              `Bonjour, je souhaite souscrire au plan *${plan.name}* (${plan.price_xof.toLocaleString(
                'fr-FR'
              )} F CFA/mois).`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-sm bg-[#25D366] text-white hover:bg-[#20BA5A] transition-all shadow-sm hover:shadow-md"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Contacter sur WhatsApp
          </a>
        )}
      </div>

      {/* Note for future features */}
      {features.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          Certaines fonctionnalités seront activées progressivement.
        </p>
      )}
    </div>
  )
}
