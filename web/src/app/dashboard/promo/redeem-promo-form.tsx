'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RedeemPromoForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!code.trim()) {
      setMessage({ type: 'error', text: 'Veuillez entrer un code promo' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/redeem-promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur activation code')
      }

      setMessage({
        type: 'success',
        text: data.message,
      })
      setCode('')

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-card rounded-xl border border-border p-8 shadow-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
            <span className="text-3xl">🎟️</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Activer un code promo</h1>
          <p className="text-muted-foreground text-sm">
            Entrez votre code pour activer instantanément votre abonnement
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="promo-code" className="block text-sm font-medium mb-2">
              Code promo
            </label>
            <input
              id="promo-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SMS1-ABC123"
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-lg text-center tracking-wider"
              disabled={loading}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Le code est sensible à la casse et est généralement au format SMS1-XXXXXX
            </p>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400'
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400'
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
              {message.type === 'success' && (
                <p className="text-xs mt-1 opacity-75">
                  Redirection vers le dashboard...
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                Activation en cours...
              </span>
            ) : (
              '✨ Activer mon abonnement'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span>💡</span> Comment obtenir un code promo ?
          </h3>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Contactez notre équipe sur WhatsApp</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Effectuez un paiement et suivez les instructions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Profitez d'une offre promotionnelle spéciale</span>
            </li>
          </ul>

          <div className="mt-4">
            <a
              href="https://wa.me/2250778030075?text=Bonjour%2C%20je%20souhaite%20obtenir%20un%20code%20promo."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#25D366] hover:underline font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Contacter sur WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

