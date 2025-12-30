import { Suspense } from 'react'
import { ReturnContent } from './return-content'

export default function BillingReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <ReturnContent />
    </Suspense>
  )
}




