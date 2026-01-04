import { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Console</h1>
            <p className="text-sm text-muted-foreground">
              Rôle: <span className="font-medium text-foreground">{admin.role}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
              ← Retour dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <aside className="bg-card border border-border rounded-lg p-4 h-fit">
            <nav className="space-y-1">
              <Link className="block px-3 py-2 rounded-md hover:bg-muted text-sm" href="/admin">
                📊 Vue d’ensemble
              </Link>
              <Link className="block px-3 py-2 rounded-md hover:bg-muted text-sm" href="/admin/users">
                👤 Utilisateurs
              </Link>
              <Link className="block px-3 py-2 rounded-md hover:bg-muted text-sm" href="/admin/orgs">
                🏢 Organisations
              </Link>
              <Link className="block px-3 py-2 rounded-md hover:bg-muted text-sm" href="/admin/subscriptions">
                💳 Abonnements
              </Link>
              <Link className="block px-3 py-2 rounded-md hover:bg-muted text-sm" href="/admin/traffic">
                📈 Trafic & activité
              </Link>
              <Link className="block px-3 py-2 rounded-md hover:bg-muted text-sm" href="/admin/events">
                🧾 Événements (logs)
              </Link>
            </nav>
          </aside>

          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  )
}


