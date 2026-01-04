import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlansCard } from './plans-card'

export default async function PlansPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get all plans
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-hero opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,197,94,0.1),transparent_50%)]" />

      {/* Back button */}
      <div className="relative z-10 container mx-auto px-4 py-6">
        <a 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition font-semibold"
        >
          ← Retour au dashboard
        </a>
      </div>

      <main className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <div className="inline-block mb-4">
            <div className="w-20 h-20 bg-gradient-primary rounded-3xl shadow-brutal flex items-center justify-center text-4xl animate-float border-4 border-black dark:border-white">
              💳
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            Choisissez votre <span className="gradient-text">plan</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
            Paiement sécurisé via <span className="font-bold text-primary">Payfonte</span> en XOF
          </p>
        </div>

        {/* Current subscription banner - Discret */}
        {currentSubscription && (
          <div className="mb-8 max-w-4xl mx-auto animate-fade-in">
            <div className="glass-card rounded-2xl p-4 border-2 border-green-500/20 bg-green-500/5 text-center">
              <p className="text-sm">
                <span className="text-xl">✅</span> Abonnement <span className="font-bold text-green-700 dark:text-green-400">{currentSubscription.plans?.name}</span> actif jusqu'au <span className="font-bold">{new Date(currentSubscription.current_period_end).toLocaleDateString('fr-FR')}</span>
              </p>
            </div>
          </div>
        )}

        {/* Plans grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans?.map((plan, index) => (
            <div
              key={plan.id}
              className="animate-scale-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <PlansCard
                plan={plan}
                isActive={currentSubscription?.plan_id === plan.id}
              />
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-16 text-center animate-fade-in">
          <p className="text-sm text-muted-foreground mb-4 font-semibold uppercase tracking-wider">
            Paiement sécurisé
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <span className="px-4 py-2 bg-muted rounded-full text-sm font-bold">
              🔒 SSL Encryption
            </span>
            <span className="px-4 py-2 bg-muted rounded-full text-sm font-bold">
              💳 Payfonte Gateway
            </span>
            <span className="px-4 py-2 bg-muted rounded-full text-sm font-bold">
              🇨🇮 XOF (F CFA)
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}


