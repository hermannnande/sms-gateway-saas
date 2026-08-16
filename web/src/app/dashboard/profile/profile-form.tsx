'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User as SupabaseUser } from '@supabase/supabase-js'
import {
  User,
  Lock,
  Settings,
  MessageSquare,
  Clock,
  Mail,
  Globe,
  Moon,
  CheckSquare,
  Radio,
  Zap,
  QrCode,
} from 'lucide-react'
import QRCode from 'qrcode'

type UserSettings = {
  user_id: string
  full_name?: string
  timezone?: string
  language?: string
  message_delay_seconds?: number
  message_delay_max_seconds?: number | null
  batch_pause_enabled?: boolean
  batch_pause_count?: number
  batch_pause_min_seconds?: number
  batch_pause_max_seconds?: number
  email_notifications?: boolean
  notification_email?: string
  sleep_start_time?: string
  sleep_end_time?: string
  request_delivery_receipt?: boolean
  wait_for_network_confirmation?: boolean
  auto_retry_failed?: boolean
  ussd_delay_seconds?: number
} | null

export function ProfileForm({ 
  user,
  orgName,
  userSettings 
}: { 
  user: SupabaseUser
  orgName: string
  userSettings: UserSettings
}) {
  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Profile settings
  const [fullName, setFullName] = useState(userSettings?.full_name || '')
  const [timezone, setTimezone] = useState(userSettings?.timezone || 'UTC')
  const [language, setLanguage] = useState(userSettings?.language || 'fr')

  // Message settings
  const [messageDelay, setMessageDelay] = useState(Math.max(5, userSettings?.message_delay_seconds ?? 6))
  const [messageDelayMax, setMessageDelayMax] = useState(Math.max(9, userSettings?.message_delay_max_seconds ?? 9))

  // Pause de régulation PAR LOT (par défaut 45-75s toutes les 10 SMS)
  const [batchPauseEnabled, setBatchPauseEnabled] = useState(userSettings?.batch_pause_enabled ?? true)
  const [batchPauseCount, setBatchPauseCount] = useState(userSettings?.batch_pause_count || 10)
  const [batchPauseMin, setBatchPauseMin] = useState(Math.max(30, userSettings?.batch_pause_min_seconds ?? 45))
  const [batchPauseMax, setBatchPauseMax] = useState(Math.max(30, userSettings?.batch_pause_max_seconds ?? 75))
  const [emailNotifications, setEmailNotifications] = useState(userSettings?.email_notifications || false)
  const [notificationEmail, setNotificationEmail] = useState(userSettings?.notification_email || user.email || '')
  const [sleepStartTime, setSleepStartTime] = useState(userSettings?.sleep_start_time || '')
  const [sleepEndTime, setSleepEndTime] = useState(userSettings?.sleep_end_time || '')
  const [requestDeliveryReceipt, setRequestDeliveryReceipt] = useState(userSettings?.request_delivery_receipt || false)
  const [waitForNetworkConfirmation, setWaitForNetworkConfirmation] = useState(userSettings?.wait_for_network_confirmation || false)
  const [autoRetryFailed, setAutoRetryFailed] = useState(userSettings?.auto_retry_failed || false)

  // USSD settings
  const [ussdDelay, setUssdDelay] = useState(userSettings?.ussd_delay_seconds || 5)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas')
      }

      if (newPassword.length < 8) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères')
      }

      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const supabase = createClient()

      // Upsert user settings
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          full_name: fullName,
          timezone,
          language,
          message_delay_seconds: messageDelay,
          message_delay_max_seconds: messageDelayMax > messageDelay
            ? messageDelayMax
            : Math.min(messageDelay + 4, 120),
          batch_pause_enabled: batchPauseEnabled,
          batch_pause_count: batchPauseCount,
          batch_pause_min_seconds: batchPauseMin,
          batch_pause_max_seconds: batchPauseMax > batchPauseMin ? batchPauseMax : batchPauseMin,
          email_notifications: emailNotifications,
          notification_email: notificationEmail,
          sleep_start_time: sleepStartTime || null,
          sleep_end_time: sleepEndTime || null,
          request_delivery_receipt: requestDeliveryReceipt,
          wait_for_network_confirmation: waitForNetworkConfirmation,
          auto_retry_failed: autoRetryFailed,
          ussd_delay_seconds: ussdDelay,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateSessionQr() {
    setQrLoading(true)
    setQrError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      const session = data.session
      if (!session?.access_token || !session.refresh_token) {
        throw new Error('Session introuvable. Reconnectez-vous.')
      }

      // IMPORTANT: QR "compact" (plus fiable à scanner sur mobile).
      // L'app Flutter se connecte en appelant `refreshSession(refresh_token)`.
      const payload = JSON.stringify({
        type: 'session',
        session: {
          refresh_token: session.refresh_token,
        },
        issued_at: new Date().toISOString(),
        v: 2,
      })

      const url = await QRCode.toDataURL(payload, {
        width: 260,
        margin: 2,
      })
      setQrUrl(url)
    } catch (err: any) {
      setQrError(err.message)
    } finally {
      setQrLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* User card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold mb-4">
                {user.email?.[0]?.toUpperCase()}
              </div>
              <h3 className="font-semibold text-lg mb-1">{fullName || 'Utilisateur'}</h3>
              <p className="text-sm text-muted-foreground mb-1">{user.email}</p>
              <p className="text-xs text-muted-foreground">Organisation: {orgName}</p>
            </div>
          </div>

          {/* Quick info */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-3">
            <h4 className="font-semibold text-sm mb-3">Informations rapides</h4>
            <div className="flex items-center gap-3 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Fuseau: <span className="font-medium text-foreground">{timezone}</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Langue: <span className="font-medium text-foreground">{language === 'fr' ? 'Français' : language}</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Délai SMS: <span className="font-medium text-foreground">{messageDelay}s</span></span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* QR Session for mobile login */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <QrCode className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Connexion mobile par QR (session)</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Scannez ce QR dans l’app Android pour vous connecter automatiquement (access_token + refresh_token),
                puis passez au pairage de l’appareil.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <button
                  onClick={handleGenerateSessionQr}
                  disabled={qrLoading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {qrLoading ? 'Génération…' : 'Générer / Régénérer le QR de session'}
                </button>
                {qrError && (
                  <span className="text-sm text-destructive">{qrError}</span>
                )}
              </div>
              {qrUrl && (
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  <img
                    src={qrUrl}
                    alt="QR de session"
                    className="w-56 h-56 border border-border rounded-xl shadow-sm bg-white"
                  />
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">Étapes :</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Ouvrez l’app Android</li>
                      <li>Choisissez “QR compte” sur l’écran de connexion</li>
                      <li>Scannez ce QR pour importer la session</li>
                      <li>Pairer ensuite votre téléphone (QR device ou token)</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Change password */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Changer le mot de passe</h3>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                  placeholder="Entrez votre mot de passe actuel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                  placeholder="Minimum 8 caractères"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirmez le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                  placeholder="Confirmez votre nouveau mot de passe"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {loading ? 'Modification...' : 'Changer le mot de passe'}
              </button>
            </form>
          </div>

          {/* General settings */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Paramètres généraux</h3>
            </div>
            <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                  placeholder="Votre nom complet"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Fuseau horaire
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                  >
                    <option value="UTC">UTC</option>
                    <option value="Africa/Abidjan">Africa/Abidjan (GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Langue
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer les paramètres'}
              </button>
            </form>
          </div>

          {/* Message settings */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Paramètres des messages</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-4 bg-muted/20 border border-border rounded-lg p-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Délai minimum entre les messages (5-120 secondes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5"
                      max="120"
                      value={messageDelay}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        setMessageDelay(v)
                        // Le max ne peut pas passer sous le min
                        if (messageDelayMax !== 0 && messageDelayMax < v) setMessageDelayMax(v)
                      }}
                      className="flex-1"
                    />
                    <span className="font-mono font-semibold text-primary w-12 text-center">{messageDelay}s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Radio className="h-4 w-4" />
                    Marge maximum de régulation
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="120"
                      value={messageDelayMax}
                      onChange={(e) => setMessageDelayMax(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-mono font-semibold text-primary w-16 text-center">
                      {messageDelayMax > messageDelay ? `${messageDelayMax}s` : 'auto'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {messageDelayMax > messageDelay ? (
                      <>Chaque SMS attendra entre <b>{messageDelay}s et {messageDelayMax}s</b>. Cette marge lisse la charge du gateway, sans garantir le classement du message par l&apos;opérateur.</>
                    ) : (
                      <>Marge automatique : chaque SMS attendra entre <b>{messageDelay}s et {Math.min(messageDelay + 4, 120)}s</b>.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Pause anti-spam PAR LOT */}
              <div className="space-y-4 bg-muted/20 border border-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="batchPauseEnabled"
                    checked={batchPauseEnabled}
                    onChange={(e) => setBatchPauseEnabled(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-primary"
                  />
                  <div className="flex-1">
                    <label htmlFor="batchPauseEnabled" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Radio className="h-4 w-4" />
                      Pause de régulation par lot
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Après un lot de SMS, l’envoi marque une pause plus longue avant de reprendre. Les destinataires doivent avoir donné leur consentement et pouvoir utiliser STOP.
                    </p>
                  </div>
                </div>

                {batchPauseEnabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Nombre de SMS avant pause
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={batchPauseCount}
                          onChange={(e) => setBatchPauseCount(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <span className="font-mono font-semibold text-primary w-16 text-center">{batchPauseCount} SMS</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Pause minimum (secondes)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="30"
                          max="300"
                          value={batchPauseMin}
                          onChange={(e) => {
                            const v = parseInt(e.target.value)
                            setBatchPauseMin(v)
                            if (batchPauseMax < v) setBatchPauseMax(v)
                          }}
                          className="flex-1"
                        />
                        <span className="font-mono font-semibold text-primary w-12 text-center">{batchPauseMin}s</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Pause maximum (aléatoire)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="30"
                          max="300"
                          value={batchPauseMax}
                          onChange={(e) => setBatchPauseMax(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <span className="font-mono font-semibold text-primary w-12 text-center">{batchPauseMax}s</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Toutes les <b>{batchPauseCount} SMS</b>, l’envoi marquera une pause entre <b>{batchPauseMin}s et {Math.max(batchPauseMax, batchPauseMin)}s</b>.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded accent-primary"
                />
                <div className="flex-1">
                  <label htmlFor="emailNotifications" className="text-sm font-medium cursor-pointer">
                    Envoyer les messages reçus par e-mail
                  </label>
                  {emailNotifications && (
                    <input
                      type="email"
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition mt-2"
                      placeholder="votre@email.com"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Heure du sommeil (ne pas envoyer de SMS)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="time"
                    value={sleepStartTime}
                    onChange={(e) => setSleepStartTime(e.target.value)}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                    placeholder="Début"
                  />
                  <input
                    type="time"
                    value={sleepEndTime}
                    onChange={(e) => setSleepEndTime(e.target.value)}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                    placeholder="Fin"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="deliveryReceipt"
                    checked={requestDeliveryReceipt}
                    onChange={(e) => setRequestDeliveryReceipt(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <label htmlFor="deliveryReceipt" className="text-sm cursor-pointer">
                    Demander un accusé de réception pour chaque message envoyé (SMS uniquement)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="waitNetwork"
                    checked={waitForNetworkConfirmation}
                    onChange={(e) => setWaitForNetworkConfirmation(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <label htmlFor="waitNetwork" className="text-sm cursor-pointer">
                    N'envoyez le prochain message de la campagne qu'une fois le message actuel traité par l'opérateur réseau
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoRetry"
                    checked={autoRetryFailed}
                    onChange={(e) => setAutoRetryFailed(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <label htmlFor="autoRetry" className="text-sm cursor-pointer">
                    Messages d'échec de la nouvelle tentative automatique
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* USSD settings */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Paramètres USSD</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Délai avant la requête USSD (secondes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={ussdDelay}
                  onChange={(e) => setUssdDelay(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
                />
              </div>
            </div>
          </div>

          {/* Save all button */}
          <button
            onClick={handleProfileUpdate}
            disabled={loading}
            className="w-full px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/90 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? 'Enregistrement en cours...' : '💾 Enregistrer tous les paramètres'}
          </button>
        </div>
      </div>
    </div>
  )
}
