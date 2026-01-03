'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import * as XLSX from 'xlsx'
import { Users, FileText, Database, Send } from 'lucide-react'

type Template = {
  id: string
  name: string
  body: string
}

type ContactInputMode = 'manual' | 'file' | 'database'

export function NewCampaignForm({
  templates,
  contactsCount: dbContactsCount,
}: {
  templates: Template[]
  contactsCount: number
}) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [contactInputMode, setContactInputMode] = useState<ContactInputMode>('manual')
  const [manualContacts, setManualContacts] = useState('')
  const [fileContacts, setFileContacts] = useState<
    { phone_e164: string; name?: string }[]
  >([])
  const [fileInvalidPhones, setFileInvalidPhones] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Update message body when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setMessageBody(selectedTemplate.body)
    }
  }, [selectedTemplate])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileContacts([])
    setFileInvalidPhones([])

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const data = event.target?.result

        let parsedContacts: { phone_e164: string; name?: string }[] = []
        const invalidPhones: string[] = []

        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          const text = data as string
          const lines = text.split('\n').filter(Boolean)
          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
          const phoneIndex = headers.indexOf('phone')
          const nameIndex = headers.indexOf('name')

          if (phoneIndex === -1) {
            setError('Le fichier doit contenir une colonne "phone".')
            return
          }

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',')
            const phone = values[phoneIndex]?.trim()
            const name = nameIndex !== -1 ? values[nameIndex]?.trim() : undefined

            if (phone) {
              const phoneNumber = parsePhoneNumberFromString(phone)
              if (phoneNumber?.isValid()) {
                parsedContacts.push({
                  phone_e164: phoneNumber.format('E.164'),
                  name,
                })
              } else {
                invalidPhones.push(phone)
              }
            }
          }
        } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json(worksheet) as any[]

          if (json.length === 0) {
            setError('Le fichier Excel est vide ou mal formaté.')
            return
          }

          for (const row of json) {
            const phone = row.phone?.toString().trim()
            const name = row.name?.toString().trim()

            if (phone) {
              const phoneNumber = parsePhoneNumberFromString(phone)
              if (phoneNumber?.isValid()) {
                parsedContacts.push({
                  phone_e164: phoneNumber.format('E.164'),
                  name,
                })
              } else {
                invalidPhones.push(phone)
              }
            }
          }
        } else {
          setError('Format de fichier non supporté. Utilisez CSV, TXT, XLS ou XLSX.')
          return
        }

        setFileInvalidPhones(invalidPhones)
        if (parsedContacts.length === 0) {
          setError('Aucun contact valide trouvé dans le fichier.')
        }
        setFileContacts(parsedContacts)
      }
      reader.readAsArrayBuffer(file)
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
      const phoneNumber = parsePhoneNumberFromString(phone)
      if (phoneNumber?.isValid()) {
        valid.push({ phone_e164: phoneNumber.format('E.164') })
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          org_id: orgMember.org_id,
          name,
          template_id: templateId || null,
          // IMPORTANT: claim_messages_atomic ne claim que les campagnes en 'running'
          // Donc on démarre immédiatement la campagne (le pause/resume reste possible).
          status: 'running',
          created_by: userData.user.id,
          total_count: contactsToProcess.length,
          sent_count: 0,
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      const messages = contactsToProcess.map((contact) => {
        let finalBody = messageBody
        if (contact.name) {
          finalBody = finalBody.replace(/{nom}/gi, contact.name)
          finalBody = finalBody.replace(/{name}/gi, contact.name)
        }

        return {
          org_id: orgMember.org_id,
          campaign_id: campaign.id,
          to_phone_e164: contact.phone_e164,
          body_final: finalBody,
          status: 'queued',
        }
      })

      const { error: messagesError } = await supabase
        .from('messages')
        .insert(messages)

      if (messagesError) throw messagesError

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
            disabled={loading || totalContactsToSend === 0}
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
