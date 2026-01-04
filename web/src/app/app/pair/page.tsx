import { Suspense } from 'react'
import PairClient from './pair-client'

export const dynamic = 'force-dynamic'

export default function PairAppPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">Chargement…</div>
          </div>
        </div>
      }
    >
      <PairClient />
    </Suspense>
  )
}


