'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import * as XLSX from 'xlsx'
import { Users, FileText, Database, Send } from 'lucide-react'
import {
  MAX_CAMPAIGN_MESSAGE_VARIANTS,
  createSmartVariantRotation,
  normalizeMessageVariants,
} from '@/lib/message-variants'

/**
 * Try to parse a phone number in multiple ways to maximize acceptance
 * of international numbers in any format.
 */
function smartParsePhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-().]/g, '').trim()
  if (!cleaned) return null

  // Replace leading 00 with +
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2)
  // Ensure + prefix if it looks like a full international number (11-15 digits)
  if (/^\d{11,15}$/.test(cleaned)) cleaned = '+' + cleaned

  // 1) Try as-is (handles +XXXXXXXXXXXX)
  let pn = parsePhoneNumberFromString(cleaned)
  if (pn?.isValid()) return pn.format('E.164')

  // 2) Try adding + if missing
  if (!cleaned.startsWith('+')) {
    pn = parsePhoneNumberFromString('+' + cleaned)
    if (pn?.isValid()) return pn.format('E.164')
  }

  // 3) Try common country codes for shorter numbers
  const countryGuesses: { digits: number; countries: CountryCode[] } [] = [
    { digits: 10, countries: ['CI', 'FR', 'CM', 'SN', 'ML', 'BF', 'GN', 'TG', 'BJ', 'NE', 'MG', 'CD', 'CG', 'GA', 'MA', 'TN', 'DZ'] },
    { digits: 9,  countries: ['CI', 'FR', 'CM', 'SN', 'BE', 'PT', 'ES', 'IT', 'DE', 'NL', 'CH'] },
    { digits: 8,  countries: ['CI', 'SN', 'ML', 'BF', 'TG', 'BJ', 'NE', 'GN', 'LU'] },
    { digits: 11, countries: ['US', 'BR', 'RU', 'NG', 'PK', 'BD'] },
    { digits: 12, countries: ['CN', 'IN', 'JP'] },
  ]

  const digitOnly = cleaned.replace(/\D/g, '')
  for (const guess of countryGuesses) {
    if (digitOnly.length === guess.digits) {
      for (const cc of guess.countries) {
        pn = parsePhoneNumberFromString(cleaned, cc)
        if (pn?.isValid()) return pn.format('E.164')
      }
    }
  }

  return null
}

type Template = {
  id: string
  name: string
  body: string
}

type DeviceOption = {
  id: string
  name: string
  status?: string | null
}

type ContactInputMode = 'manual' | 'file' | 'database'

export function NewCampaignForm({
  templates,
  contactsCount: dbContactsCount,
  devices,
}: {
  templates: Template[]
  contactsCount: number
  devices: DeviceOption[]
}) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [messageBody, setMessageBody] = useState('')
  // Jusqu'à 14 textes supplémentaires (15 avec le message principal), répartis
  // ensuite par rotation aléatoire équilibrée.
  const [extraMessages, setExtraMessages] = useState<string[]>([])
  const [contactInputMode, setContactInputMode] = useState<ContactInputMode>('manual')
  const [manualContacts, setManualContacts] = useState('')
  const [simSlotIndex, setSimSlotIndex] = useState<number | null>(null)
  const [deviceId, setDeviceId] = useState<string>('')
  const [priority, setPriority] = useState<number>(0)
  const [fileContacts, setFileContacts] = useState<
    { phone_e164: string; name?: string }[]
  >([])
  const [fileInvalidPhones, setFileInvalidPhones] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skippedBlacklist, setSkippedBlacklist] = useState<string[]>([])
  const router = useRouter()

  // Un seul appareil : sélection automatique
  useEffect(() => {
    if (devices.length === 1) {
      setDeviceId(devices[0].id)
    }
  }, [devices])

  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Update message body when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setMessageBody(selectedTemplate.body)
    }
  }, [selectedTemplate])

  const parseTextFile = (text: string) => {
    const parsedContacts: { phone_e164: string; name?: string }[] = []
    const invalidPhones: string[] = []

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return { parsedContacts, invalidPhones }

    // Auto-detect separator: comma, semicolon, or tab
    const firstLine = lines[0]
    const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','

    const headers = firstLine.split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ''))

    // Try to find phone column by various names
    const phoneAliases = ['phone', 'telephone', 'tel', 'mobile', 'numero', 'numéro', 'phone_e164', 'number', 'n°']
    const nameAliases = ['name', 'nom', 'prenom', 'prénom', 'firstname', 'first_name', 'contact']

    let phoneIndex = -1
    let nameIndex = -1

    for (const alias of phoneAliases) {
      const idx = headers.findIndex((h) => h.includes(alias))
      if (idx !== -1) { phoneIndex = idx; break }
    }
    for (const alias of nameAliases) {
      const idx = headers.findIndex((h) => h.includes(alias))
      if (idx !== -1) { nameIndex = idx; break }
    }

    // If no header detected, assume first column is phone (and no header row)
    const hasHeader = phoneIndex !== -1
    if (!hasHeader) {
      phoneIndex = 0
      nameIndex = headers.length > 1 ? 1 : -1
    }

    const startLine = hasHeader ? 1 : 0

    for (let i = startLine; i < lines.length; i++) {
      const values = lines[i].split(sep).map((v) => v.trim().replace(/["']/g, ''))
      const rawPhone = values[phoneIndex]?.trim()
      const name = nameIndex !== -1 ? values[nameIndex]?.trim() : undefined

      if (!rawPhone) continue

      const e164 = smartParsePhone(rawPhone)
      if (e164) {
        parsedContacts.push({ phone_e164: e164, name })
      } else {
        invalidPhones.push(rawPhone)
      }
    }

    return { parsedContacts, invalidPhones }
  }

  const parseExcelFile = (data: ArrayBuffer) => {
    const parsedContacts: { phone_e164: string; name?: string }[] = []
    const invalidPhones: string[] = []

    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

    if (json.length === 0) return { parsedContacts, invalidPhones, empty: true }

    // Find phone and name columns by matching header names
    const keys = Object.keys(json[0])
    const phoneAliases = ['phone', 'telephone', 'tel', 'mobile', 'numero', 'numéro', 'phone_e164', 'number']
    const nameAliases = ['name', 'nom', 'prenom', 'prénom', 'firstname', 'first_name', 'contact']

    let phoneKey = keys.find((k) => phoneAliases.some((a) => k.toLowerCase().includes(a)))
    const nameKey = keys.find((k) => nameAliases.some((a) => k.toLowerCase().includes(a)))

    // If no phone column found, use first column
    if (!phoneKey) phoneKey = keys[0]

    for (const row of json) {
      const rawPhone = row[phoneKey]?.toString().trim()
      const name = nameKey ? row[nameKey]?.toString().trim() : undefined

      if (!rawPhone) continue

      const e164 = smartParsePhone(rawPhone)
      if (e164) {
        parsedContacts.push({ phone_e164: e164, name })
      } else {
        invalidPhones.push(rawPhone)
      }
    }

    return { parsedContacts, invalidPhones, empty: false }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileContacts([])
    setFileInvalidPhones([])

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const isText = ext === 'csv' || ext === 'txt'

      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result
        if (!data) { setError('Impossible de lire le fichier.'); return }

        let result: { parsedContacts: { phone_e164: string; name?: string }[]; invalidPhones: string[]; empty?: boolean }

        if (isText) {
          result = parseTextFile(data as string)
        } else if (ext === 'xls' || ext === 'xlsx') {
          result = parseExcelFile(data as ArrayBuffer)
          if (result.empty) {
            setError('Le fichier Excel est vide ou mal formaté.')
            return
          }
        } else {
          setError('Format de fichier non supporté. Utilisez CSV, TXT, XLS ou XLSX.')
          return
        }

        setFileInvalidPhones(result.invalidPhones)
        if (result.parsedContacts.length === 0) {
          setError(`Aucun contact valide trouvé dans le fichier. ${result.invalidPhones.length} numéro(s) invalide(s) détecté(s).`)
        }
        setFileContacts(result.parsedContacts)
      }

      if (isText) {
        reader.readAsText(file, 'UTF-8')
      } else {
        reader.readAsArrayBuffer(file)
      }
    } catch (err: any) {
      setError(`Erreur lors de la lecture du fichier: ${err.message}`)
    }
  }

  const manualParse = useMemo(() => {
    const phones = manualContacts
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)

    const valid: { phone_e164: string }[] = []
    const invalid: string[] = []

    for (const phone of phones) {
      const e164 = smartParsePhone(phone)
      if (e164) {
        valid.push({ phone_e164: e164 })
      } else {
        invalid.push(phone)
      }
    }

    return { valid, invalid, total: phones.length }
  }, [manualContacts])

  const getContactsForCampaign = useCallback(() => {
    if (contactInputMode === 'manual') {
      return manualParse.valid
    } else if (contactInputMode === 'file') {
      return fileContacts
    } else {
      return []
    }
  }, [contactInputMode, manualParse.valid, fileContacts])

  const totalContactsToSend =
    contactInputMode === 'database'
      ? dbContactsCount
      : contactInputMode === 'manual'
        ? manualParse.valid.length
        : getContactsForCampaign().length

  const canSubmitDevice =
    devices.length === 1 ||
    (devices.length >= 2 && deviceId.trim() !== '')

  const canSubmit = devices.length > 0 && canSubmitDevice && totalContactsToSend > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSkippedBlacklist([])

    try {
      const supabase = createClient()

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Non authentifié')

      const { data: orgMember } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userData.user.id)
        .single()

      if (!orgMember) throw new Error('Organisation introuvable')

      if (!messageBody.trim()) {
        throw new Error('Le message SMS ne peut pas être vide.')
      }

      const resolvedDeviceId =
        devices.length === 1 ? devices[0].id : deviceId.trim() || null

      if (devices.length === 0) {
        throw new Error(
          'Aucun appareil connecté. Liez un appareil depuis la page Appareils avant de lancer une campagne.',
        )
      }
      if (devices.length >= 2 && !resolvedDeviceId) {
        throw new Error('Sélectionnez l\'appareil qui enverra cette campagne.')
      }

      let contactsToProcess: { phone_e164: string; name?: string }[] = []

      if (contactInputMode === 'database') {
        const { data: dbContacts, error: dbContactsError } = await supabase
          .from('contacts')
          .select('*')
          .eq('org_id', orgMember.org_id)
          .eq('opt_in', true)

        if (dbContactsError) throw dbContactsError
        contactsToProcess = dbContacts.map(c => ({ phone_e164: c.phone_e164, name: c.name || undefined }))
      } else {
        contactsToProcess = getContactsForCampaign()
      }

      if (contactsToProcess.length === 0) {
        throw new Error('Aucun contact valide à qui envoyer le message.')
      }

      // Filtrer les contacts présents dans la liste noire (optouts).
      // Cela évite d'insérer des messages qui resteraient bloqués en "queued"
      // pour toujours, et garantit que la campagne se termine proprement.
      const { data: optouts, error: optoutsError } = await supabase
        .from('optouts')
        .select('phone_e164')
        .eq('org_id', orgMember.org_id)

      if (optoutsError) {
        throw new Error('Erreur lors de la lecture de la liste noire : ' + optoutsError.message)
      }

      const blacklistSet = new Set((optouts ?? []).map((o) => o.phone_e164))
      const beforeCount = contactsToProcess.length
      const blacklistedNumbers: string[] = []
      contactsToProcess = contactsToProcess.filter((c) => {
        if (blacklistSet.has(c.phone_e164)) {
          blacklistedNumbers.push(c.phone_e164)
          return false
        }
        return true
      })

      if (blacklistedNumbers.length > 0) {
        setSkippedBlacklist(blacklistedNumbers)
      }

      if (contactsToProcess.length === 0) {
        const all = beforeCount === blacklistedNumbers.length
        throw new Error(
          all
            ? `Tous les contacts (${beforeCount}) sont dans la liste noire. Aucune campagne créée.`
            : 'Aucun contact valide à qui envoyer le message.',
        )
      }

      // Rotation équilibrée : chaque variante passe une fois dans un ordre
      // mélangé avant d'être réutilisée, sans répétition consécutive.
      const messageVariants = normalizeMessageVariants(messageBody, extraMessages)
      if (messageVariants.length > MAX_CAMPAIGN_MESSAGE_VARIANTS) {
        throw new Error(
          `Maximum ${MAX_CAMPAIGN_MESSAGE_VARIANTS} messages différents par campagne.`,
        )
      }
      const variantRotation = createSmartVariantRotation(
        messageVariants,
        contactsToProcess.length,
      )

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          org_id: orgMember.org_id,
          name,
          template_id: templateId || null,
          device_id: resolvedDeviceId,
          sim_slot_index: simSlotIndex,
          priority,
          status: 'running',
          created_by: userData.user.id,
          total_count: contactsToProcess.length,
          sent_count: 0,
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      const messages = contactsToProcess.map((contact, index) => {
        const variant = variantRotation[index]
        let finalBody = variant
        if (contact.name) {
          finalBody = finalBody.replace(/{nom}/gi, contact.name)
          finalBody = finalBody.replace(/{name}/gi, contact.name)
        }

        return {
          org_id: orgMember.org_id,
          campaign_id: campaign.id,
          to_phone_e164: contact.phone_e164,
          body_final: finalBody,
          campaign_sequence: index,
          status: 'queued',
        }
      })

      const batchSize = 500
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize)
        const { error: messagesError } = await supabase
          .from('messages')
          .insert(batch)
        if (messagesError) throw messagesError
      }

      router.push(`/dashboard/campaigns/${campaign.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const charCount = messageBody.length
  const smsCount = Math.ceil(charCount / 160)

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <form onSubmit={handleSubmit} className="space-y-6 p-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-xl flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {skippedBlacklist.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 rounded-xl flex items-start gap-3">
            <span className="text-lg">🚫</span>
            <div>
              <p className="font-semibold">
                {skippedBlacklist.length} numéro{skippedBlacklist.length > 1 ? 's' : ''} ignoré{skippedBlacklist.length > 1 ? 's' : ''} (liste noire)
              </p>
              <p className="text-xs mt-1 font-mono break-all">
                {skippedBlacklist.slice(0, 5).join(', ')}
                {skippedBlacklist.length > 5 ? `… (+${skippedBlacklist.length - 5})` : ''}
              </p>
              <p className="text-xs mt-1 text-amber-700">
                Ces contacts ne recevront aucun SMS car ils figurent dans votre liste noire.
              </p>
            </div>
          </div>
        )}

        {/* Nom de la campagne */}
        <div>
          <label htmlFor="name" className="block text-sm font-semibold mb-2 text-foreground">
            Nom de la campagne <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
            placeholder="Ex: Promotion Noël 2024"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ce nom vous aidera à identifier votre campagne
          </p>
        </div>

        {/* Destinataires */}
        <div>
          <label className="block text-sm font-semibold mb-3 text-foreground">
            📞 Destinataires <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setContactInputMode('manual')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                contactInputMode === 'manual'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/70 text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              Saisir manuellement
            </button>
            <button
              type="button"
              onClick={() => setContactInputMode('file')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                contactInputMode === 'file'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/70 text-foreground'
              }`}
            >
              <FileText className="h-4 w-4" />
              Importer fichier
            </button>
            <button
              type="button"
              onClick={() => setContactInputMode('database')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                contactInputMode === 'database'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/70 text-foreground'
              }`}
            >
              <Database className="h-4 w-4" />
              Contacts enregistrés ({dbContactsCount})
            </button>
          </div>

          {contactInputMode === 'manual' && (
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <textarea
                id="manual-contacts"
                rows={6}
                value={manualContacts}
                onChange={(e) => setManualContacts(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background font-mono text-sm transition"
                placeholder="Saisissez les numéros au format international E.164 :&#10;+2250708090001,+33612345678,+12025551234"
              />
              {manualParse.invalid.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-sm">
                  <p className="font-semibold">
                    {manualParse.invalid.length} numéro(s) invalide(s) ignoré(s)
                    {manualParse.valid.length > 0 ? ` • ${manualParse.valid.length} valide(s)` : ''}
                  </p>
                  <p className="text-xs mt-1">
                    Exemple CI (Côte d’Ivoire) : <code className="bg-amber-100 px-1 rounded">+225</code> suivi de <b>10 chiffres</b>.
                  </p>
                  <p className="text-xs mt-2 font-mono break-all">
                    {manualParse.invalid.slice(0, 5).join(', ')}
                    {manualParse.invalid.length > 5 ? '…' : ''}
                  </p>
                </div>
              )}
              <div className="flex items-start gap-2 mt-2 text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-3">
                <span className="text-blue-600">💡</span>
                <div>
                  <p className="font-semibold text-blue-800 mb-1">Format international requis (E.164)</p>
                  <p>Exemples : +225 (CI), +33 (FR), +1 (US), +86 (CN), +34 (ES), +49 (DE)</p>
                </div>
              </div>
            </div>
          )}

          {contactInputMode === 'file' && (
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition">
                <input
                  id="contact-file"
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer"
                />
              </div>
              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-3">
                <p className="font-semibold text-blue-800 mb-1">📋 Format du fichier</p>
                <p>• Formats : CSV, TXT, XLS, XLSX</p>
                <p>• Colonnes requises : <code className="bg-blue-100 px-1 rounded">phone</code></p>
                <p>• Colonnes optionnelles : <code className="bg-blue-100 px-1 rounded">name</code></p>
              </div>
              {fileContacts.length > 0 && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <span className="font-semibold">{fileContacts.length} contacts valides détectés</span>
                </div>
              )}
              {fileInvalidPhones.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg">
                  <p className="font-semibold">
                    {fileInvalidPhones.length} numéro(s) invalide(s) ignoré(s)
                  </p>
                  <p className="text-xs mt-1 font-mono break-all">
                    {fileInvalidPhones.slice(0, 5).join(', ')}
                    {fileInvalidPhones.length > 5 ? '…' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {contactInputMode === 'database' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">💾</div>
              <p className="font-semibold text-blue-900 mb-1">Contacts enregistrés</p>
              <p className="text-sm text-blue-700">
                La campagne sera envoyée aux <span className="font-bold">{dbContactsCount} contacts</span> avec opt-in de votre base de données
              </p>
            </div>
          )}
        </div>

        {/* Appareil d'envoi */}
        <div>
          <label htmlFor="device-id" className="block text-sm font-semibold mb-2 text-foreground">
            📱 Appareil d&apos;envoi {devices.length >= 2 && <span className="text-red-500">*</span>}
          </label>
          {devices.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg text-sm">
              Aucun appareil lié.{' '}
              <a href="/dashboard/devices" className="font-semibold underline hover:no-underline">
                Connecter un appareil
              </a>{' '}
              avant de lancer une campagne.
            </div>
          ) : devices.length === 1 ? (
            <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-muted/30">
              <span className="text-xl">📱</span>
              <div>
                <p className="font-semibold text-sm">{devices[0].name}</p>
                <p className="text-xs text-muted-foreground">
                  Seul appareil disponible — sélectionné automatiquement
                </p>
              </div>
              {devices[0].status === 'online' && (
                <span className="ml-auto text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-md">
                  En ligne
                </span>
              )}
            </div>
          ) : (
            <>
              <select
                id="device-id"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
              >
                <option value="">-- Choisir l&apos;appareil qui enverra les SMS --</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                    {device.status === 'online' ? ' (En ligne)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Seul l&apos;appareil choisi enverra les SMS de cette campagne. Les autres appareils ne les récupéreront pas.
              </p>
            </>
          )}
        </div>

        {/* SIM */}
        <div>
          <label htmlFor="sim-slot" className="block text-sm font-semibold mb-2 text-foreground">
            📲 SIM utilisée pour l’envoi (optionnel)
          </label>
          <select
            id="sim-slot"
            value={simSlotIndex === null ? '' : String(simSlotIndex)}
            onChange={(e) => {
              const v = e.target.value
              setSimSlotIndex(v === '' ? null : Number(v))
            }}
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
          >
            <option value="">Auto (SIM par défaut du téléphone)</option>
            <option value="0">SIM 1</option>
            <option value="1">SIM 2</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Le téléphone enverra automatiquement via la SIM choisie pour cette campagne (sans action dans l’app).
          </p>
        </div>

        {/* Priorité */}
        <div>
          <label htmlFor="priority" className="block text-sm font-semibold mb-2 text-foreground">
            🚦 Priorité de la campagne
          </label>
          <div className="flex gap-2">
            {[
              { value: 0, label: 'Normale', icon: '🟢', desc: 'Ordre standard (FIFO)', color: 'border-green-300 bg-green-50 text-green-800' },
              { value: 1, label: 'Haute', icon: '🟡', desc: 'Passe avant les campagnes normales', color: 'border-yellow-300 bg-yellow-50 text-yellow-800' },
              { value: 2, label: 'Urgente', icon: '🔴', desc: 'Envoyée en premier', color: 'border-red-300 bg-red-50 text-red-800' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`flex-1 flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all ${
                  priority === opt.value
                    ? `${opt.color} ring-2 ring-offset-1 ring-primary shadow-sm`
                    : 'border-border bg-background hover:bg-muted/50'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Si plusieurs campagnes sont actives, les messages de la campagne avec la priorité la plus haute seront envoyés en premier.
          </p>
        </div>

        {/* Template */}
        <div>
          <label htmlFor="template" className="block text-sm font-semibold mb-3 text-foreground">
            📝 Charger un template (optionnel)
          </label>
          <select
            id="template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition"
          >
            <option value="">-- Sélectionner un template enregistré --</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Sélectionnez un template pour pré-remplir le message ci-dessous
          </p>
        </div>

        {/* Message SMS */}
        <div>
          <label htmlFor="message-body" className="block text-sm font-semibold mb-3 text-foreground">
            💬 Message SMS <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <textarea
              id="message-body"
              rows={8}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background font-mono text-sm transition resize-none"
              placeholder="Saisissez votre message SMS ici...&#10;&#10;Astuce : Utilisez {nom} pour personnaliser avec le nom du contact"
              required
            />
          </div>
          <div className="flex justify-between items-center text-xs mt-2">
            <div className="flex items-center gap-4">
              <span className={`font-semibold ${charCount > 160 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {charCount} caractères
              </span>
              <span className="text-muted-foreground">•</span>
              <span className={`font-semibold ${smsCount > 1 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {smsCount} SMS
              </span>
            </div>
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
              Variables : {'{nom}'}, {'{name}'}
            </div>
          </div>

          {/* Variantes de message (facultatif) — rotation aléatoire anti-spam */}
          <div className="mt-4 space-y-3">
            {extraMessages.map((variant, idx) => (
              <div key={idx} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Variante {idx + 2}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExtraMessages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Retirer
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={variant}
                  onChange={(e) =>
                    setExtraMessages((prev) =>
                      prev.map((m, i) => (i === idx ? e.target.value : m)),
                    )
                  }
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background font-mono text-sm transition resize-none"
                  placeholder={`Variante ${idx + 2} du message (envoyée à une partie des contacts, au hasard)`}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setExtraMessages((prev) => [...prev, ''])}
              disabled={extraMessages.length >= MAX_CAMPAIGN_MESSAGE_VARIANTS - 1}
              className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              ➕ Ajouter un message différent ({extraMessages.length + 1}/{MAX_CAMPAIGN_MESSAGE_VARIANTS})
            </button>

            {extraMessages.length >= MAX_CAMPAIGN_MESSAGE_VARIANTS - 1 && (
              <p className="text-xs font-medium text-amber-700">
                Limite atteinte : {MAX_CAMPAIGN_MESSAGE_VARIANTS} messages par campagne.
              </p>
            )}

            {extraMessages.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <span>🎲</span>
                <p>
                  <b>Rotation intelligente activée</b> : les messages sont mélangés,
                  répartis équitablement et utilisés chacun une fois avant de recommencer.
                  Deux numéros consécutifs ne recevront pas le même texte.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-primary/5 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🚀</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Prêt à lancer ?</h3>
              <p className="text-sm text-blue-700">
                Cette campagne enverra <span className="font-bold">{totalContactsToSend} SMS</span> {totalContactsToSend > 1 ? 'aux contacts' : 'au contact'} sélectionné{totalContactsToSend > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                SIM: <span className="font-semibold">{simSlotIndex === null ? 'Auto' : simSlotIndex === 0 ? 'SIM 1' : 'SIM 2'}</span>
                {' • '}
                Priorité: <span className="font-semibold">{priority === 2 ? '🔴 Urgente' : priority === 1 ? '🟡 Haute' : '🟢 Normale'}</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Estimation : ~{smsCount * totalContactsToSend} SMS au total ({smsCount} SMS par contact)
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Création en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Créer et lancer la campagne
              </>
            )}
          </button>
          <a
            href="/dashboard/campaigns"
            className="px-8 py-3 border-2 border-border rounded-lg font-semibold hover:bg-muted transition text-center flex items-center justify-center"
          >
            Annuler
          </a>
        </div>
      </form>
    </div>
  )
}
