import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RedeemPromoForm } from './redeem-promo-form'

export const metadata = {
  title: 'Activer un code promo | SMSenvoie',
}

export default async function RedeemPromoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <RedeemPromoForm />
    </div>
  )
}

