import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user has devices
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  let hasDevice = false
  if (orgMember) {
    const { count } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)
    hasDevice = (count || 0) > 0
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
          Aller au dashboard
        </a>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-2xl mb-6 shadow-lg">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Bienvenue sur SMS Gateway !
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Votre compte est créé avec le <span className="font-semibold text-primary">plan Gratuit</span> : 1 appareil + 100 SMS offerts.
            <br />
            Suivez ces 3 étapes simples pour commencer à envoyer vos SMS.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-12">
          {/* Step 1 */}
          <div className="bg-card rounded-xl border-2 border-border p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Télécharger l&apos;application Android</h2>
                <p className="text-muted-foreground mb-4">
                  Téléchargez l&apos;APK sur votre téléphone Android pour commencer.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://github.com/hermannnande/sms-gateway-saas/releases/latest/download/sms-gateway.apk"
                    download
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Télécharger l&apos;APK
                    <span className="text-xs opacity-80">(~70 MB)</span>
                  </a>
                  <a
                    href="https://wa.me/2250778030075?text=Bonjour%2C%20je%20n%27arrive%20pas%20%C3%A0%20t%C3%A9l%C3%A9charger%20l%27APK."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-lg font-semibold hover:bg-[#20BA5A] transition-all shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Demander sur WhatsApp
                  </a>
                </div>
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-semibold mb-2">💡 Comment installer l&apos;APK ?</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Ouvrez le fichier <code className="px-1 py-0.5 bg-background rounded text-xs">sms-gateway.apk</code> téléchargé</li>
                    <li>Autorisez l&apos;installation depuis des sources inconnues si demandé</li>
                    <li>Suivez les instructions à l&apos;écran</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-card rounded-xl border-2 border-border p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Scanner votre appareil</h2>
                <p className="text-muted-foreground mb-4">
                  Depuis le dashboard web, générez un QR code pour connecter votre téléphone.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold mb-2">📱 Sur le Web (Dashboard)</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Allez dans <span className="font-semibold">Appareils</span></li>
                      <li>Cliquez <span className="font-semibold">Ajouter un appareil</span></li>
                      <li>Un QR code s&apos;affiche</li>
                    </ol>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold mb-2">📷 Sur l&apos;App Android</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Ouvrez l&apos;app SMS Gateway</li>
                      <li>Cliquez sur <span className="font-semibold">Scanner</span></li>
                      <li>Scannez le QR code affiché sur le web</li>
                    </ol>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <span className="font-semibold">Astuce :</span> Accordez les permissions SMS et Téléphone quand l&apos;app les demande.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-card rounded-xl border-2 border-border p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Envoyer votre première campagne SMS</h2>
                <p className="text-muted-foreground mb-4">
                  Vous êtes prêt ! Créez une campagne et envoyez vos SMS.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-3xl mb-2">👥</div>
                    <p className="text-sm font-semibold">1. Importez vos contacts</p>
                    <a href="/dashboard/contacts" className="text-xs text-primary hover:underline">
                      Aller aux contacts →
                    </a>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-3xl mb-2">📝</div>
                    <p className="text-sm font-semibold">2. Créez un template</p>
                    <a href="/dashboard/templates" className="text-xs text-primary hover:underline">
                      Créer un template →
                    </a>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-3xl mb-2">🚀</div>
                    <p className="text-sm font-semibold">3. Lancez une campagne</p>
                    <a href="/dashboard/campaigns/new" className="text-xs text-primary hover:underline">
                      Nouvelle campagne →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {hasDevice ? (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">✓ Appareil connecté !</h3>
            <p className="text-muted-foreground mb-6">
              Félicitations, vous pouvez maintenant envoyer des SMS depuis le dashboard.
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              Accéder au Dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Aucun appareil connecté</h3>
            <p className="text-muted-foreground mb-6">
              Suivez les étapes ci-dessus pour connecter votre premier appareil Android.
            </p>
            <a
              href="/dashboard/devices"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              Connecter un appareil
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Besoin d&apos;aide ? Contactez-nous sur WhatsApp
          </p>
          <a
            href="https://wa.me/2250778030075?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20pour%20configurer%20mon%20appareil."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#20BA5A] transition-all"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Aide WhatsApp
          </a>
        </div>
      </main>
    </div>
  )
}
