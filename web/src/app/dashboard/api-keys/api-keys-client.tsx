'use client'

import { useEffect, useState } from 'react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export function ApiKeysClient() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCreatedKey, setNewCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadKeys() {
    setLoading(true)
    try {
      const res = await fetch('/api/keys')
      const data = await res.json()
      if (data.ok) setKeys(data.keys)
      else setError(data.error)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [])

  async function createKey() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Clef API' }),
      })
      const data = await res.json()
      if (data.ok) {
        setNewCreatedKey(data.key.api_key)
        setNewKeyName('')
        await loadKeys()
      } else {
        setError(data.error)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoquer cette clef ? Les applications qui l\'utilisent seront immediatement bloquees ET les campagnes en cours creees via cette clef seront annulees. Cette action est definitive.')) return
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) await loadKeys()
      else setError(data.error)
    } catch (e: any) {
      setError(e.message)
    }
  }

  function copyKey() {
    if (newCreatedKey) {
      navigator.clipboard.writeText(newCreatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function closeKeyModal() {
    setNewCreatedKey(null)
    setShowCreateModal(false)
  }

  const activeKeys = keys.filter((k) => !k.revoked_at)
  const revokedKeys = keys.filter((k) => k.revoked_at)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🔑 Clefs API</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connectez vos applications, boutique e-commerce ou outils de relance pour envoyer des SMS automatiquement.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/docs/api"
            target="_blank"
            className="px-4 py-2.5 rounded-lg font-medium text-sm bg-muted text-foreground hover:bg-muted/70 transition"
          >
            📖 Documentation
          </a>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm"
          >
            + Nouvelle clef
          </button>
        </div>
      </div>

      {/* Info securite */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-foreground">
        <p className="font-semibold mb-1">🔒 Securite</p>
        <p className="text-muted-foreground">
          Vos clefs sont stockees sous forme hachee (SHA-256) et ne sont jamais conservees en clair.
          La clef complete n'est affichee qu'<strong>une seule fois</strong> a la creation — copiez-la immediatement.
          Ne la partagez jamais publiquement (pas dans le code client, ni sur GitHub).
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Liste des clefs */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Clefs actives ({activeKeys.length})</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Chargement...</div>
        ) : activeKeys.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-4xl mb-3">🔑</p>
            <p className="text-muted-foreground">Aucune clef API. Creez-en une pour connecter vos applications.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activeKeys.map((k) => (
              <div key={k.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{k.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{k.key_prefix}••••••••</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Creee le {new Date(k.created_at).toLocaleDateString('fr-FR')}
                    {k.last_used_at
                      ? ` • Derniere utilisation le ${new Date(k.last_used_at).toLocaleDateString('fr-FR')}`
                      : ' • Jamais utilisee'}
                  </p>
                </div>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition self-start sm:self-center"
                >
                  Revoquer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clefs revoquees */}
      {revokedKeys.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden opacity-70">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-muted-foreground">Clefs revoquees ({revokedKeys.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {revokedKeys.map((k) => (
              <div key={k.id} className="px-6 py-3">
                <p className="font-medium text-muted-foreground line-through">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal creation */}
      {showCreateModal && !newCreatedKey && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-foreground mb-4">Nouvelle clef API</h3>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nom de la clef (pour vous y retrouver)
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Ex: Boutique Shopify, Relance clients..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition"
              >
                Annuler
              </button>
              <button
                onClick={createKey}
                disabled={creating}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
              >
                {creating ? 'Creation...' : 'Generer la clef'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clef creee (affichee UNE SEULE FOIS) */}
      {newCreatedKey && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-foreground mb-2">✅ Clef creee avec succes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <strong className="text-destructive">Copiez cette clef maintenant.</strong> Pour des raisons de securite,
              elle ne sera <strong>jamais reaffichee</strong>.
            </p>
            <div className="flex gap-2 items-center bg-muted rounded-lg p-3 mb-4">
              <code className="flex-1 text-sm font-mono text-foreground break-all select-all">{newCreatedKey}</code>
              <button
                onClick={copyKey}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition shrink-0"
              >
                {copied ? '✓ Copie' : 'Copier'}
              </button>
            </div>
            <div className="bg-muted rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-foreground mb-1">Exemple d'utilisation :</p>
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre">{`curl -X POST https://smsenvoie.com/api/v1/sms \\
  -H "Authorization: Bearer ${newCreatedKey.substring(0, 20)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+2250707000000", "message": "Bonjour !"}'`}</pre>
            </div>
            <div className="flex gap-2 justify-end">
              <a
                href="/docs/api"
                target="_blank"
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition"
              >
                Voir la doc
              </a>
              <button
                onClick={closeKeyModal}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                J'ai copie la clef
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
