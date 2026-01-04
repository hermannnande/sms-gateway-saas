'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reference = searchParams.get('reference')

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('Vérification du paiement...')

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setStatus('failed')
        setMessage('Référence de paiement manquante')
        return
      }

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          throw new Error('Non authentifié')
        }

        // Wait a bit for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Call verify Edge Function
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/billing_verify`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ reference }),
          }
        )

        if (!response.ok) {
          throw new Error('Erreur vérification')
        }

        const data = await response.json()

        if (data.status === 'success') {
          setStatus('success')
          setMessage('Paiement confirmé ! Votre abonnement est actif.')
          setTimeout(() => router.push('/dashboard'), 3000)
        } else {
          setStatus('failed')
          setMessage('Le paiement n\'a pas été confirmé.')
        }
      } catch (error: any) {
        setStatus('failed')
        setMessage(error.message || 'Erreur lors de la vérification')
      }
    }

    verifyPayment()
  }, [reference, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-2">Vérification en cours...</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-primary mb-2">Paiement réussi !</h2>
            <p className="text-muted-foreground mb-4">{message}</p>
            <p className="text-sm text-muted-foreground">
              Redirection vers le dashboard...
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-destructive mb-2">Paiement échoué</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <a
              href="/billing/plans"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Réessayer
            </a>
          </>
        )}
      </div>
    </div>
  )
}








