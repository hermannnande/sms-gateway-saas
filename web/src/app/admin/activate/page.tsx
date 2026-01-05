import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/guard'
import { ActivateSubscriptionForm } from './activate-form'

export const metadata = {
  title: 'Activer un abonnement | Admin',
}

export default async function ActivateSubscriptionPage() {
  const adminRole = await requireAdmin()
  
  if (!adminRole) {
    redirect('/dashboard')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Activer un abonnement manuellement</h1>
        <p className="text-muted-foreground">
          Interface d'activation manuelle pour les paiements hors-ligne ou sans webhook.
        </p>
      </div>

      <ActivateSubscriptionForm />
    </div>
  )
}

