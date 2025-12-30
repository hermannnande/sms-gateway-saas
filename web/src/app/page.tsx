import { HomeButton } from '@/components/home/HomeButton'
import { HomeCard } from '@/components/home/HomeCard'
import { SectionTitle } from '@/components/home/SectionTitle'
import { ScrollReveal } from '@/components/home/ScrollReveal'

const useCases = [
  {
    title: 'E-commerce',
    text: 'Relances panier, confirmations de commande, codes promo géolocalisés.',
    icon: '🛒',
  },
  {
    title: 'Retail / Proximité',
    text: 'Drive-to-store, fidélisation, offres du week-end, anniversaires clients.',
    icon: '🏪',
  },
  {
    title: 'Services B2B',
    text: 'Relances devis, notifications d&apos;intervention, suivi client personnalisé.',
    icon: '💼',
  },
  {
    title: 'Support & SAV',
    text: 'RDV, rappels, satisfaction, information proactive pour éviter les appels.',
    icon: '🎧',
  },
  {
    title: 'Recouvrement soft',
    text: 'Rappels d&apos;échéance courtois, scénarios multi-relances maîtrisés.',
    icon: '💳',
  },
  {
    title: 'Événementiel',
    text: 'Rappels J-1, codes d&apos;accès, messages de dernière minute, NPS à chaud.',
    icon: '🎟️',
  },
]

const features = [
  {
    title: 'Envoi en masse piloté',
    text: 'Planification, file d&apos;attente, pause/reprise/annulation, anti-doublon.',
    icon: '📤',
  },
  {
    title: 'Multi-SIM Android',
    text: 'Répartissez le trafic, évitez le blocage opérateur, choisissez la SIM par campagne.',
    icon: '📱',
  },
  {
    title: 'Suivi temps réel',
    text: 'Progression, livraisons, échecs, opt-out, quotas, journal complet.',
    icon: '📊',
  },
  {
    title: 'Contact & Opt-out',
    text: 'Import CSV/Excel, opt-in/out gérés, formats internationaux, tags et segments.',
    icon: '📋',
  },
  {
    title: 'API & Webhooks',
    text: 'Déclenchez vos envois depuis vos apps (HTTP/Supabase), recevez les statuts.',
    icon: '🔌',
  },
  {
    title: 'Sécurité & RLS',
    text: 'RLS Supabase, tokens hashés, contrôle par organisation et rôles (admin/agent).',
    icon: '🔐',
  },
]

const steps = [
  {
    step: '01',
    title: 'Créez votre compte',
    text: 'Inscription en 2 minutes, aucune carte requise pour démarrer.',
    icon: '✨',
  },
  {
    step: '02',
    title: 'Pairer un téléphone',
    text: 'Scannez le QR code sur l&apos;app Android, multi-SIM prêt à envoyer.',
    icon: '📲',
  },
  {
    step: '03',
    title: 'Lancez vos campagnes',
    text: 'Importez vos contacts, choisissez un template, suivez en direct.',
    icon: '🚀',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section - Premium spacing & gradients */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Background layers - premium gradients */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-background to-accent/[0.02]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,hsl(221_83%_53%/0.04),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,hsl(142_76%_36%/0.03),transparent_60%)]" />
        
        {/* Subtle grid pattern */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.015]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28 lg:py-36">
          {/* Badge premium avec animation */}
          <div className="mb-10 inline-flex animate-fade-in items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition-all duration-300 hover:scale-105 hover:border-primary/30 hover:bg-primary/10 hover:shadow-brutal-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="hidden sm:inline">Plateforme SMS Gateway</span>
            <span className="sm:hidden">SMS Gateway</span>
            <span className="hidden sm:inline text-primary/60">•</span>
            <span className="hidden sm:inline text-primary/80">Commerce & B2B</span>
          </div>

          {/* Hero Content - 2 colonnes responsive avec spacing premium */}
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-20">
            {/* Left: Heading + CTA */}
            <div className="space-y-10 animate-slide-up">
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                Boostez vos ventes et la{' '}
                <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent [text-shadow:_0_1px_2px_hsl(var(--background)/0.5)]">
                  fidélité clients
                </span>
                <br />
                <span className="text-foreground/90">avec le SMS piloté</span>
              </h1>

              <p className="max-w-xl text-lg leading-[1.7] text-muted-foreground sm:text-xl">
                Centralisez vos envois, connectez vos téléphones Android multi-SIM, suivez en
                temps réel. Pensé pour le commerce, l&apos;e-commerce, les services B2B et le
                support client.
              </p>

              {/* CTA Buttons - premium spacing */}
              <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:gap-5">
                <HomeButton
                  href="/auth/register"
                  variant="primary"
                  size="lg"
                  ariaLabel="Créer un compte gratuitement"
                >
                  Créer un compte
                  <svg className="ml-1 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </HomeButton>
                <HomeButton
                  href="/auth/login"
                  variant="outline"
                  size="lg"
                  ariaLabel="Se connecter à votre compte"
                >
                  Se connecter
                </HomeButton>
              </div>

              {/* Stats inline - premium design */}
              <div className="grid grid-cols-3 gap-6 pt-8">
                <div className="group space-y-2 transition-transform duration-300 hover:scale-105">
                  <div className="text-3xl font-black text-primary sm:text-4xl transition-colors group-hover:text-primary/80">98%</div>
                  <div className="text-xs leading-tight text-muted-foreground sm:text-sm">Taux d&apos;ouverture</div>
                </div>
                <div className="group space-y-2 transition-transform duration-300 hover:scale-105">
                  <div className="text-3xl font-black text-secondary sm:text-4xl transition-colors group-hover:text-secondary/80">+40%</div>
                  <div className="text-xs leading-tight text-muted-foreground sm:text-sm">vs email</div>
                </div>
                <div className="group space-y-2 transition-transform duration-300 hover:scale-105">
                  <div className="text-3xl font-black text-accent sm:text-4xl transition-colors group-hover:text-accent/80">&lt;3min</div>
                  <div className="text-xs leading-tight text-muted-foreground sm:text-sm">Setup</div>
                </div>
              </div>
            </div>

            {/* Right: Feature highlights card - premium glassmorphism */}
            <div className="group relative animate-fade-in rounded-3xl border border-border/60 bg-gradient-to-br from-card/95 to-card/80 p-8 shadow-xl backdrop-blur-md transition-all duration-500 hover:shadow-2xl lg:p-10">
              {/* Subtle glow effect */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="relative z-10">
                <div className="mb-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-500/20">
                  <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Pourquoi nos clients gagnent plus
                </div>

                <ul className="space-y-5">
                  {[
                    'Automatisez vos campagnes SMS et réduisez les coûts d&apos;acquisition',
                    'Connectez vos téléphones Android (multi-SIM) en quelques minutes',
                    'Suivi temps réel : livraisons, réponses, opt-out, quotas',
                    'Anti-spam natif : rate limiting, gestion STOP, déduplication',
                    'S&apos;intègre à vos outils (API Supabase/HTTP) pour déclencher des envois',
                  ].map((item, idx) => (
                    <li key={item} className="group/item flex gap-4 text-sm leading-relaxed transition-all duration-300 hover:translate-x-1" style={{ animationDelay: `${idx * 50}ms` }}>
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/15 to-emerald-600/10 text-xs font-bold text-emerald-700 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover/item:scale-110 group-hover/item:shadow-sm">
                        ✓
                      </span>
                      <span className="text-foreground/80 group-hover/item:text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 flex flex-wrap gap-3">
                  <div className="group/badge rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md">
                    <span className="flex items-center gap-2">
                      📈 ROI mesurable
                    </span>
                  </div>
                  <div className="group/badge rounded-xl border border-blue-200/60 bg-gradient-to-r from-blue-500/10 to-blue-600/10 px-5 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md">
                    <span className="flex items-center gap-2">
                      📱 Multi-SIM ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section - premium spacing & design */}
      <section className="border-b border-border/50 bg-background py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <ScrollReveal>
            <SectionTitle
              title="Cas d'usage concrets"
              subtitle="Ce que nos clients déploient au quotidien pour vendre plus, réduire l'attrition, et améliorer l'expérience."
              align="center"
              className="mb-16"
            />
          </ScrollReveal>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {useCases.map((useCase, idx) => (
              <ScrollReveal key={useCase.title} delay={idx * 80}>
                <HomeCard
                  title={useCase.title}
                  description={useCase.text}
                  icon={useCase.icon}
                  variant="elevated"
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - contraste visuel premium */}
      <section className="relative border-b border-border/50 bg-gradient-to-b from-muted/20 to-muted/40 py-20 sm:py-28 lg:py-32">
        {/* Subtle pattern overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-[0.02]" />
        
        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8">
          <ScrollReveal>
            <SectionTitle
              title="Fonctionnalités clés"
              subtitle="Une plateforme opérationnelle de bout en bout : envoi, suivi, conformité, API."
              align="center"
              className="mb-16"
            />
          </ScrollReveal>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {features.map((feature, idx) => (
              <ScrollReveal key={feature.title} delay={idx * 80}>
                <HomeCard
                  title={feature.title}
                  description={feature.text}
                  icon={feature.icon}
                  variant="glass"
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Steps Section - premium design avec numérotation */}
      <section className="border-b border-border/50 bg-background py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <ScrollReveal>
            <SectionTitle
              title="Démarrez en 3 étapes"
              subtitle="Aucune complexité : compte, téléphone Android, envoi."
              align="center"
              className="mb-16"
            />
          </ScrollReveal>

          <div className="grid gap-10 sm:grid-cols-3 lg:gap-12">
            {steps.map((step, idx) => (
              <ScrollReveal key={step.step} delay={idx * 120}>
                <div className="group relative rounded-3xl border border-border bg-gradient-to-br from-card to-card/80 p-8 shadow-lg backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl lg:p-10">
                  {/* Subtle glow on hover */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  
                  {/* Step number - premium badge */}
                  <div className="absolute -top-5 left-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-base font-black text-primary-foreground shadow-brutal-primary ring-4 ring-background transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow">
                    {step.step}
                  </div>

                  <div className="relative z-10">
                    {/* Icon avec animation */}
                    <div className="mb-8 mt-6 text-5xl transition-all duration-500 group-hover:scale-125 group-hover:rotate-3">
                      {step.icon}
                    </div>

                    {/* Content */}
                    <h3 className="mb-4 text-xl font-black">{step.title}</h3>
                    <p className="text-sm leading-[1.7] text-muted-foreground">{step.text}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final Section - premium avec gradients subtils */}
      <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-primary/[0.02] via-background to-secondary/[0.02] py-20 sm:py-28 lg:py-36">
        {/* Background elements */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(221_83%_53%/0.03),transparent_70%)]" />
        
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center sm:px-8">
          <ScrollReveal>
            <div className="space-y-10">
              {/* Badge */}
              <div className="inline-flex animate-pulse-glow items-center gap-2.5 rounded-full border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-3 text-base font-bold text-primary shadow-brutal-primary ring-1 ring-primary/10 transition-all duration-300 hover:scale-105">
                <span className="text-xl">🚀</span>
                <span>Prêt à décoller ?</span>
              </div>

              {/* Heading */}
              <h2 className="text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Lancez vos campagnes SMS
                <br />
                <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                  dès aujourd&apos;hui
                </span>
              </h2>

              {/* Subtitle */}
              <p className="mx-auto max-w-2xl text-lg leading-[1.7] text-muted-foreground sm:text-xl">
                Inscrivez-vous, connectez vos téléphones Android multi-SIM, et pilotez vos envois
                avec une visibilité totale.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col gap-5 pt-4 sm:flex-row sm:justify-center">
                <HomeButton href="/auth/register" variant="primary" size="lg">
                  Créer mon compte
                  <svg className="ml-1 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </HomeButton>
                <HomeButton href="/auth/login" variant="outline" size="lg">
                  Me connecter
                </HomeButton>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Aucune carte bancaire requise
                </span>
                <span className="hidden sm:inline text-muted-foreground/40">•</span>
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Setup en moins de 3 minutes
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer - premium design */}
      <footer className="border-t border-border/50 bg-gradient-to-b from-background to-muted/10 py-16">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            {/* Brand */}
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-xl text-primary-foreground shadow-brutal-primary">
                  📱
                </div>
                <div className="text-xl font-black tracking-tight">SMS Gateway</div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Plateforme professionnelle d&apos;envoi SMS via Android Gateway. Boostez vos ventes et fidélisez vos clients.
              </p>
            </div>

            {/* Produit */}
            <div className="space-y-4">
              <div className="text-sm font-bold uppercase tracking-wider text-foreground/80">Produit</div>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="/auth/register" className="text-muted-foreground transition-colors hover:text-primary">
                    Créer un compte
                  </a>
                </li>
                <li>
                  <a href="/auth/login" className="text-muted-foreground transition-colors hover:text-primary">
                    Se connecter
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-4">
              <div className="text-sm font-bold uppercase tracking-wider text-foreground/80">Support</div>
              <ul className="space-y-3 text-sm">
                <li>
                  <span className="cursor-not-allowed text-muted-foreground/50">Documentation</span>
                </li>
                <li>
                  <span className="cursor-not-allowed text-muted-foreground/50">API</span>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <div className="text-sm font-bold uppercase tracking-wider text-foreground/80">Légal</div>
              <ul className="space-y-3 text-sm">
                <li>
                  <span className="cursor-not-allowed text-muted-foreground/50">CGU</span>
                </li>
                <li>
                  <span className="cursor-not-allowed text-muted-foreground/50">Confidentialité</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-10 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SMS Gateway. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                Made with
                <span className="text-red-500">❤️</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
