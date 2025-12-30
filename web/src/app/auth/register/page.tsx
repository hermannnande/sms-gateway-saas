import { RegisterForm } from './register-form'

export default function RegisterPage() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(34,197,94,0.15),transparent_50%)]" />
      
      <div className="relative z-10 w-full max-w-lg animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 bg-gradient-accent rounded-2xl shadow-brutal-accent flex items-center justify-center text-3xl animate-float border-4 border-black dark:border-white">
              ✨
            </div>
          </div>
          <h1 className="text-4xl font-black mb-2">
            <span className="gradient-text">Créez votre compte</span>
          </h1>
          <p className="text-muted-foreground">Lancez votre première campagne SMS en 2 minutes</p>
        </div>
        
        <div className="glass-card rounded-3xl p-8 shadow-brutal animate-slide-up border-4 border-black/10 dark:border-white/10">
          <RegisterForm />
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-muted-foreground hover:text-primary transition">
            ← Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  )
}


