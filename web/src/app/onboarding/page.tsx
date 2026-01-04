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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_60%)]" />
      
      <div className="relative z-10 max-w-3xl w-full animate-scale-in">
        {/* Success animation */}
        <div className="text-center mb-8">
          <div className="inline-block mb-6">
            <div className="w-24 h-24 bg-gradient-primary rounded-3xl shadow-brutal flex items-center justify-center text-5xl animate-float border-4 border-black dark:border-white">
              🎉
            </div>
          </div>
          <h1 className="text-5xl font-black mb-4">
            <span className="gradient-text">Bienvenue !</span>
          </h1>
          <p className="text-muted-foreground text-xl">
            Votre compte est créé avec succès
          </p>
        </div>

        {/* Main card */}
        <div className="glass-card rounded-3xl p-10 border-4 border-black/10 dark:border-white/10 text-center space-y-8 animate-slide-up">
          <div className="space-y-4">
            <p className="text-2xl font-bold">
              Vous êtes prêt à envoyer des SMS ! 🚀
            </p>
            <p className="text-muted-foreground text-lg">
              Votre compte est activé avec le <span className="font-bold text-primary">plan Gratuit</span>.<br/>
              <span className="font-bold">1 appareil</span> + <span className="font-bold">100 SMS offerts</span> pour démarrer.
            </p>
          </div>
          
          {/* Info box */}
          <div className="glass-card rounded-2xl p-6 border-3 border-primary/20 bg-primary/5">
            <div className="flex items-start gap-4">
              <span className="text-4xl">💡</span>
              <div className="text-left">
                <p className="font-bold text-lg mb-2">Prochaines étapes :</p>
                <ol className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="font-bold text-primary">1.</span> Connecter un appareil Android
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-bold text-primary">2.</span> Importer vos contacts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-bold text-primary">3.</span> Créer une campagne SMS
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/dashboard"
              className="px-8 py-4 bg-gradient-primary text-white rounded-xl font-bold text-lg shadow-brutal-primary border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">🚀</span>
              Accéder au Dashboard
            </a>

            <a
              href="/billing/plans"
              className="px-8 py-4 bg-white dark:bg-black text-foreground rounded-xl font-bold text-lg shadow-brutal border-4 border-black dark:border-white hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="text-2xl">💳</span>
              Passer à un abonnement
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
