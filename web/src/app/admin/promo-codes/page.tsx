import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/guard'
import { PromoCodesManager } from './promo-codes-manager'

export const metadata = {
  title: 'Codes Promo | Admin',
}

export default async function PromoCodesPage() {
  const adminRole = await requireAdmin()
  
  if (!adminRole) {
    redirect('/dashboard')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestion des codes promo</h1>
        <p className="text-muted-foreground">
          Générez des codes promo pour activer des abonnements sans paiement direct.
        </p>
      </div>

      <PromoCodesManager />
    </div>
  )
}

