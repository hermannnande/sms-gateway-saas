import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlansCard } from './plans-card'
import { PageHeader } from '@/components/ui/page-header'

export default async function PlansPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get all visible plans
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('is_visible', true)
    .order('price_xof', { ascending: true })

  // Get user's current subscription
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  let currentSubscription = null
  if (orgMember) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('org_id', orgMember.org_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    currentSubscription = sub
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Navigation */}
      <div className="container mx-auto px-4 py-6">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Retour au dashboard
        </a>
      </div>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
        {/* Header Section */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
            <span>💳</span>
            Tarification simple et transparente
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Choisissez votre plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Commencez gratuitement, passez à un plan mensuel quand vous êtes prêt.
            <br />
            Paiement sécurisé via <span className="font-semibold text-foreground">Payfonte</span> en F CFA.
          </p>
        </div>

        {/* Current Subscription Banner */}
        {currentSubscription && (
          <div className="mb-12 max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Abonnement actif :{' '}
                  <span className="font-bold">{currentSubscription.plans?.name}</span>
                </p>
                {currentSubscription.current_period_end && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Renouvellement le{' '}
                    {new Date(currentSubscription.current_period_end).toLocaleDateString(
                      'fr-FR',
                      { day: 'numeric', month: 'long', year: 'numeric' }
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans?.map((plan) => (
            <PlansCard
              key={plan.id}
              plan={plan}
              isActive={currentSubscription?.plan_id === plan.id}
            />
          ))}
        </div>

        {/* Features Comparison Section */}
        <div className="bg-card rounded-xl border border-border p-8 mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            Toutes les fonctionnalités incluses
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📨', title: 'SMS illimités', desc: 'Envoyez autant de SMS que nécessaire' },
              { icon: '📱', title: 'Multi-appareils', desc: '1 à 5 appareils selon le plan' },
              { icon: '📊', title: 'Statistiques détaillées', desc: 'Suivi en temps réel' },
              { icon: '👥', title: 'Gestion contacts', desc: 'Import CSV/Excel + opt-out' },
              { icon: '📝', title: 'Templates SMS', desc: 'Modèles réutilisables' },
              { icon: '⚡', title: 'API & Webhooks', desc: 'Intégration complète' },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="text-2xl flex-shrink-0">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-card rounded-xl border border-border p-8 mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: 'Puis-je changer de plan ?',
                a: 'Oui, à tout moment. Le changement prend effet immédiatement.',
              },
              {
                q: 'Comment annuler mon abonnement ?',
                a: 'Vous pouvez annuler à tout moment depuis votre dashboard.',
              },
              {
                q: 'Le plan gratuit a-t-il des limites ?',
                a: 'Oui : 1 appareil et 100 SMS par mois.',
              },
              {
                q: 'Quels moyens de paiement acceptez-vous ?',
                a: 'Paiement sécurisé via Payfonte (Mobile Money, Visa, Mastercard).',
              },
            ].map((faq, idx) => (
              <div key={idx}>
                <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Paiement sécurisé
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg text-xs font-medium">
              <span>🔒</span> SSL / TLS
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg text-xs font-medium">
              <span>💳</span> Payfonte Gateway
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg text-xs font-medium">
              <span>🇨🇮</span> XOF (F CFA)
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg text-xs font-medium">
              <span>✓</span> Annulation facile
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
