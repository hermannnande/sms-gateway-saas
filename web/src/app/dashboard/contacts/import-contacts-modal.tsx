'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, normalizePhoneCI } from '@/lib/phone'

export function ImportContactsModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Array<{ phone: string; name?: string }>>([])
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)

    // Read and preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const contacts = parseCSV(content)
      setPreview(contacts.slice(0, 5)) // Show first 5
    }
    reader.readAsText(selectedFile)
  }

  async function handleImport() {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const content = event.target?.result as string
        const contacts = parseCSV(content)

        const supabase = createClient()

        // Get org_id
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) throw new Error('Non authentifié')

        const { data: orgMember } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', userData.user.id)
          .single()

        if (!orgMember) throw new Error('Organisation introuvable')

        // Normalize and prepare contacts
        const contactsToInsert = contacts
          .map((contact) => {
            const phoneNormalized = normalizePhoneCI(contact.phone)
            if (!phoneNormalized) return null

            return {
              org_id: orgMember.org_id,
              phone_e164: phoneNormalized,
              name: contact.name || null,
              opt_in: true, // Default opt-in
            }
          })
          .filter(Boolean)

        if (contactsToInsert.length === 0) {
          throw new Error('Aucun numéro valide trouvé dans le fichier')
        }

        // Insert contacts (upsert to avoid duplicates)
        const { error: insertError } = await supabase
          .from('contacts')
          .upsert(contactsToInsert, {
            onConflict: 'org_id,phone_e164',
            ignoreDuplicates: true,
          })

        if (insertError) throw insertError

        router.refresh()
        onClose()
      }

      reader.readAsText(file)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Importer contacts (CSV)</h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Fichier CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-4 py-2 border border-input rounded-lg"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Format attendu: phone,name (ex: 0708090001,Jean Dupont)
          </p>
        </div>

        {preview.length > 0 && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Aperçu (5 premiers):</p>
            <ul className="text-sm space-y-1">
              {preview.map((contact, i) => (
                <li key={i}>
                  {contact.phone} {contact.name ? `- ${contact.name}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Importation...' : 'Importer'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-border rounded-lg hover:bg-accent"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}




