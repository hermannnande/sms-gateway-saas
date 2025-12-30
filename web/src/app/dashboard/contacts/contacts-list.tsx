'use client'

type Contact = {
  id: string
  phone_e164: string
  name: string | null
  tags: string[]
  opt_in: boolean
  created_at: string
}

export function ContactsList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <p className="text-muted-foreground mb-4">
          Aucun contact pour le moment
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-4 font-semibold">Nom</th>
            <th className="text-left p-4 font-semibold">Téléphone</th>
            <th className="text-left p-4 font-semibold">Opt-in</th>
            <th className="text-left p-4 font-semibold">Ajouté</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-t border-border hover:bg-accent/50">
              <td className="p-4">{contact.name || '-'}</td>
              <td className="p-4 font-mono text-sm">{contact.phone_e164}</td>
              <td className="p-4">
                {contact.opt_in ? (
                  <span className="text-green-600">✓ Oui</span>
                ) : (
                  <span className="text-red-600">✗ Non</span>
                )}
              </td>
              <td className="p-4 text-sm text-muted-foreground">
                {new Date(contact.created_at).toLocaleDateString('fr-FR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}




