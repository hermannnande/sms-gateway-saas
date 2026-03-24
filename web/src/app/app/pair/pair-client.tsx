'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PairClient() {
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const deviceToken = (searchParams.get('device_token') ?? '').trim()
  const deviceName = (searchParams.get('device_name') ?? '').trim()

  const deepLink = useMemo(() => {
    const qs = new URLSearchParams()
    if (deviceToken) qs.set('device_token', deviceToken)
    if (deviceName) qs.set('device_name', deviceName)
    return `smsgateway://pair?${qs.toString()}`
  }, [deviceToken, deviceName])

  useEffect(() => {
    if (!deviceToken) {
      setError('Lien invalide: device_token manquant.')
      return
    }
    // Essai auto à l’arrivée (Android va proposer d’ouvrir l’app si installée)
    try {
      window.location.href = deepLink
    } catch (e: any) {
      setError(e?.message || 'Impossible d’ouvrir le lien.')
    }
  }, [deepLink, deviceToken])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-2">Connexion appareil</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Nous allons ouvrir l’app SMSenvoie pour connecter votre appareil.
        </p>

        {deviceName && (
          <div className="text-sm mb-4">
            Appareil: <span className="font-semibold">{deviceName}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => {
              window.location.href = deepLink
            }}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Ouvrir dans l’app (1 clic)
          </button>

          <a
            href="/app/download?source=pair"
            className="w-full inline-flex items-center justify-center py-3 rounded-lg border border-border hover:bg-muted font-semibold"
          >
            Télécharger / Mettre à jour l’app
          </a>

          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(deepLink)
                alert('Lien copié ✅')
              } catch (_) {
                alert('Impossible de copier le lien.')
              }
            }}
            className="w-full inline-flex items-center justify-center py-3 rounded-lg border border-border hover:bg-muted font-semibold"
          >
            Copier le lien
          </button>

          <a href="/dashboard/devices" className="block text-center text-sm text-primary hover:underline">
            Retour au dashboard
          </a>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Si rien ne se passe, l’app n’est peut‑être pas installée (ou pas à jour). Installe la dernière version puis réessaie.
        </p>
      </div>
    </div>
  )
}


