import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ActiveCampaignBar } from './active-campaign-bar'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's organization
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id, organizations(name)')
    .eq('user_id', user.id)
    .single()

  // Get active subscription
  let subscription = null
  if (orgMember) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('org_id', orgMember.org_id)
      .eq('status', 'active')
      .eq('plans.is_visible', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    subscription = sub
  }

  // Quota SMS (mois en cours)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  let smsUsedThisMonth = 0
  let smsQuotaMonth: number | null = subscription?.plans?.sms_quota_month ?? 100
  if (smsQuotaMonth === 0) smsQuotaMonth = null // 0 => illimité
  if (orgMember) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)
      .eq('status', 'sent')
      .gte('sent_at', monthStart)
    smsUsedThisMonth = count || 0
  }
  const smsRemaining = smsQuotaMonth === null ? null : Math.max(smsQuotaMonth - smsUsedThisMonth, 0)
  let pendingCount = 0
  if (orgMember && smsRemaining === 0) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)
      .in('status', ['queued', 'sending'])
    pendingCount = count || 0
  }

  // Get stats
  let stats = { templates: 0, contacts: 0, campaigns: 0, devices: 0 }
  if (orgMember) {
    const { count: templatesCount } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)

    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)

    const { count: campaignsCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)

    const { count: devicesCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)

    stats = {
      templates: templatesCount || 0,
      contacts: contactsCount || 0,
      campaigns: campaignsCount || 0,
      devices: devicesCount || 0,
    }
  }

  // Campagne active (pour barre Pause/Reprendre/Annuler sur le dashboard)
  let activeCampaign: any = null
  if (orgMember) {
    const { data } = await supabase
      .from('campaigns')
      .select('id,name,status,sent_count,total_count,updated_at')
      .eq('org_id', orgMember.org_id)
      .in('status', ['running', 'paused', 'queued'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    activeCampaign = data
  }

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-card rounded-lg p-6 border border-border shadow-sm">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Organisation: <span className="font-medium text-foreground">{orgMember?.organizations?.name || 'N/A'}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/app/download?source=dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all"
            >
              <span className="text-base">⬇️</span>
              Télécharger l&apos;app Android
            </a>
            <div className="text-3xl">👋</div>
          </div>
        </div>
      </div>

      {orgMember?.org_id && (
        <ActiveCampaignBar orgId={orgMember.org_id} initialCampaign={activeCampaign} />
      )}

      {/* Getting Started - Only show if no devices */}
      {stats.devices === 0 && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl">
              🚀
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">Commencer en 3 étapes</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configurez votre premier appareil pour commencer à envoyer des SMS
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span className="text-sm font-medium">Télécharger l&apos;APK</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span className="text-sm font-medium">Scanner l&apos;appareil</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span className="text-sm font-medium">Envoyer des SMS</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/onboarding"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all"
                >
                  Voir le guide complet
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
                <a
                  href="/dashboard/devices"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-all"
                >
                  Connecter un appareil
                </a>
                <a
                  href="/app/pair/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-semibold hover:bg-muted/80 transition-all"
                >
                  🔗 Lier mon appareil (1 clic)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription status */}
      {subscription ? (
        <div className="glass-card rounded-2xl p-4 border-2 border-green-500/20 bg-green-500/5 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-2xl">✅</span>
              <div className="text-green-700 dark:text-green-400">
                <div>
                  Plan <span className="font-bold">{subscription.plans?.name}</span>{' '}
                  {subscription.current_period_end ? (
                    <>actif jusqu&apos;au {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}</>
                  ) : (
                    <>actif</>
                  )}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  Quota SMS ce mois :{' '}
                  {smsRemaining === null
                    ? `${smsUsedThisMonth} envoyés (illimité)`
                    : `${smsUsedThisMonth}/${smsQuotaMonth} • reste ${smsRemaining}`}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="/billing/plans"
                className="px-4 py-2 text-xs bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition whitespace-nowrap"
              >
                Gérer l&apos;abonnement
              </a>
              <a
                href="/dashboard/promo"
                className="px-4 py-2 text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg font-bold hover:bg-purple-500/20 transition whitespace-nowrap"
                title="Activer un code promo"
              >
                🎟️ Code promo
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 border-2 border-blue-500/20 bg-blue-500/5 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-2xl">🎁</span>
              <div className="text-muted-foreground">
                <div>
                  Plan <span className="font-bold text-blue-600">Gratuit</span> : 1 appareil + 100 SMS offerts
                </div>
                <div className="text-xs mt-0.5">
                  Quota SMS ce mois : {smsUsedThisMonth}/100 • reste {smsRemaining ?? 0}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="/billing/plans"
                className="px-4 py-2 text-xs bg-primary/10 text-primary rounded-lg font-bold hover:bg-primary/20 transition whitespace-nowrap"
              >
                Passer à un abonnement
              </a>
              <a
                href="/dashboard/promo"
                className="px-4 py-2 text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg font-bold hover:bg-purple-500/20 transition whitespace-nowrap"
                title="Activer un code promo"
              >
                🎟️ Code promo
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Quota alert */}
      {smsRemaining === 0 && pendingCount > 0 && (
        <div className="glass-card rounded-2xl p-4 border-2 border-red-500/20 bg-red-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2">
              <span className="text-2xl">🚫</span>
              <div>
                <div className="font-bold text-red-700 dark:text-red-400">Quota gratuit atteint</div>
                <div className="text-sm text-muted-foreground">
                  {pendingCount} message(s) restent en attente. Ils seront envoyés après renouvellement ou après upgrade.
                </div>
              </div>
            </div>
            <a
              href="/billing/plans"
              className="px-4 py-2 text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg font-bold hover:bg-red-500/20 transition whitespace-nowrap"
            >
              Upgrade
            </a>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Appareils
              </p>
              <p className="text-3xl font-semibold text-foreground">{stats.devices}</p>
            </div>
            <div className="text-2xl opacity-60">📱</div>
          </div>
          <a href="/dashboard/devices" className="text-xs text-primary hover:underline font-medium">
            Gérer →
          </a>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Templates
              </p>
              <p className="text-3xl font-semibold text-foreground">{stats.templates}</p>
            </div>
            <div className="text-2xl opacity-60">📝</div>
          </div>
          <a href="/dashboard/templates" className="text-xs text-primary hover:underline font-medium">
            Gérer →
          </a>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Contacts
              </p>
              <p className="text-3xl font-semibold text-foreground">{stats.contacts}</p>
            </div>
            <div className="text-2xl opacity-60">👥</div>
          </div>
          <a href="/dashboard/contacts" className="text-xs text-primary hover:underline font-medium">
            Gérer →
          </a>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Campagnes
              </p>
              <p className="text-3xl font-semibold text-foreground">{stats.campaigns}</p>
            </div>
            <div className="text-2xl opacity-60">🚀</div>
          </div>
          <a href="/dashboard/campaigns" className="text-xs text-primary hover:underline font-medium">
            Gérer →
          </a>
        </div>
      </div>

      {/* Quick actions */}
      <div className="glass-card rounded-2xl p-6 border-4 border-black/10 dark:border-white/10">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
          <span>⚡</span> Actions rapides
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/dashboard/campaigns/new"
            className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 border-3 border-primary/20 hover:border-primary hover:bg-primary/20 transition-all group"
          >
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-2xl shadow-brutal-sm border-3 border-black dark:border-white group-hover:scale-110 transition-transform">
              🚀
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Nouvelle campagne</h3>
              <p className="text-sm text-muted-foreground">Créer et envoyer des SMS</p>
            </div>
            <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </a>

          <a
            href="/dashboard/devices"
            className="flex items-center gap-4 p-4 rounded-xl bg-accent/10 border-3 border-accent/20 hover:border-accent hover:bg-accent/20 transition-all group"
          >
            <div className="w-12 h-12 bg-gradient-accent rounded-xl flex items-center justify-center text-2xl shadow-brutal-sm border-3 border-black dark:border-white group-hover:scale-110 transition-transform">
              📱
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Gérer les appareils</h3>
              <p className="text-sm text-muted-foreground">Ajouter et configurer</p>
            </div>
            <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </a>

          <a
            href="/dashboard/contacts"
            className="flex items-center gap-4 p-4 rounded-xl bg-secondary/10 border-3 border-secondary/20 hover:border-secondary hover:bg-secondary/20 transition-all group"
          >
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-2xl shadow-brutal-sm border-3 border-black dark:border-white group-hover:scale-110 transition-transform">
              👥
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Importer contacts</h3>
              <p className="text-sm text-muted-foreground">CSV ou Excel</p>
            </div>
            <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </a>

          <a
            href="/dashboard/templates/new"
            className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border-3 border-green-500/20 hover:border-green-500 hover:bg-green-500/20 transition-all group"
          >
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-2xl shadow-brutal-sm border-3 border-black dark:border-white group-hover:scale-110 transition-transform">
              📝
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Nouveau template</h3>
              <p className="text-sm text-muted-foreground">Créer un modèle SMS</p>
            </div>
            <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Getting started */}
        <div className="glass-card rounded-2xl p-8 border-4 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl animate-float">🚀</div>
            <h3 className="text-2xl font-black">Démarrage rapide</h3>
          </div>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
              <div>
                <p className="font-bold">Souscrire à un plan</p>
                <p className="text-sm text-muted-foreground">Choisissez le plan adapté à vos besoins</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
              <div>
                <p className="font-bold">Connecter un appareil Android</p>
                <p className="text-sm text-muted-foreground">Scannez le QR code pour pairer</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">3</span>
              <div>
                <p className="font-bold">Importer des contacts</p>
                <p className="text-sm text-muted-foreground">CSV ou Excel acceptés</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">4</span>
              <div>
                <p className="font-bold">Créer un template</p>
                <p className="text-sm text-muted-foreground">Modèles réutilisables</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">5</span>
              <div>
                <p className="font-bold">Lancer une campagne</p>
                <p className="text-sm text-muted-foreground">Envoyez vos SMS en masse</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Features */}
        <div className="glass-card rounded-2xl p-8 border-4 border-accent/20 bg-accent/5">
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl animate-float">✨</div>
            <h3 className="text-2xl font-black">Fonctionnalités</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <span className="font-semibold">Envoi SMS multi-SIM</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <span className="font-semibold">Templates personnalisables</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">👥</span>
              <span className="font-semibold">Gestion contacts (opt-in/opt-out)</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <span className="font-semibold">Suivi temps réel</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <span className="font-semibold">Retry automatique</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <span className="font-semibold">Anti-spam intégré</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <span className="font-semibold">Statistiques détaillées</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Success banner */}
      <div className="glass-card rounded-3xl p-8 border-4 border-green-500/30 bg-gradient-to-br from-green-500/10 to-blue-500/10 text-center animate-fade-in">
        <div className="text-6xl mb-4 animate-float">🎉</div>
        <h3 className="text-3xl font-black mb-2">
          <span className="gradient-text">Plateforme SMSenvoie complète !</span>
        </h3>
        <p className="text-muted-foreground text-lg">
          Toutes les 8 étapes sont terminées. Prêt pour production.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Backend Setup
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Database & RLS
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Billing Integration
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Device Pairing
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ SMS Engine
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Android App
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Web Campaigns
          </span>
          <span className="px-4 py-2 bg-green-500/20 border-2 border-green-500/40 rounded-full text-sm font-bold text-green-700 dark:text-green-400">
            ✓ Opt-out System
          </span>
        </div>
      </div>
    </div>
  )
}
