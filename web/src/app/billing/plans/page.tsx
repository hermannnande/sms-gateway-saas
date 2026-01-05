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
            Paiement sécurisé via <span className="font-semibold text-foreground">Moneroo</span> (Orange Money, Wave, Visa, Mastercard).
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
                a: 'Paiement sécurisé via Moneroo : Orange Money, Wave, MTN Money, Moov Money, Visa, Mastercard.',
              },
            ].map((faq, idx) => (
              <div key={idx}>
                <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Contact Section */}
        <div className="bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-xl p-8 mb-12">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#25D366] rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">Besoin d&apos;aide pour choisir ?</h2>
            <p className="text-muted-foreground mb-6">
              Notre équipe est disponible sur WhatsApp pour répondre à vos questions et vous
              accompagner dans votre choix.
            </p>
            <a
              href="https://wa.me/2250778030075?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20pour%20choisir%20un%20plan%20SMS%20Gateway."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-lg font-semibold hover:bg-[#20BA5A] transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Discuter sur WhatsApp
              <span className="text-xs opacity-80">(+225 07 78 03 00 75)</span>
            </a>
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
              <span>💳</span> Moneroo Payment
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
