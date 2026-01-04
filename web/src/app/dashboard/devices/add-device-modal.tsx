'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'

export function AddDeviceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<'name' | 'qr'>('name')
  const [deviceName, setDeviceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [deviceData, setDeviceData] = useState<any>(null)

  async function handleCreateDevice() {
    if (!deviceName.trim()) {
      setError('Nom requis')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Non authentifié')
      }

      // Call Edge Function to create device
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/device_pair`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ device_name: deviceName }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur création device')
      }

      const data = await response.json()

      // Generate QR code with device data
      const qrPayload = JSON.stringify({
        device_id: data.device_id,
        device_token: data.device_token,
        api_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      })

      const qrUrl = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 2,
      })

      setQrCodeUrl(qrUrl)
      setDeviceData(data)
      setStep('qr')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
        {step === 'name' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Ajouter un appareil</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="deviceName" className="block text-sm font-medium mb-2">
                Nom de l'appareil
              </label>
              <input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: Samsung Galaxy A20"
                autoFocus
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCreateDevice}
                disabled={loading}
                className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Création...' : 'Continuer'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border border-border rounded-lg hover:bg-accent"
              >
                Annuler
              </button>
            </div>
          </>
        )}

        {step === 'qr' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Scannez ce QR code</h2>
            
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                Utilisez l'app Android Gateway pour scanner ce code
              </p>
              
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="mx-auto border-4 border-border rounded-lg"
                />
              )}

              <p className="text-xs text-muted-foreground mt-4">
                Appareil: <strong>{deviceName}</strong>
              </p>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg mb-6">
              <p className="text-sm text-center">
                ℹ️ Une fois scanné, l'appareil apparaîtra dans la liste
              </p>
            </div>

            <button
              onClick={() => {
                router.refresh()
                onClose()
              }}
              className="w-full bg-primary text-primary-foreground py-2 rounded-lg hover:opacity-90"
            >
              Terminé
            </button>
          </>
        )}
      </div>
    </div>
  )
}




