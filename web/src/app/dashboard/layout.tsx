'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Campagnes', href: '/dashboard/campaigns', icon: '🚀' },
  { name: 'Messages', href: '/dashboard/messages', icon: '📥' },
  { name: 'Contacts', href: '/dashboard/contacts', icon: '👥' },
  { name: 'Templates', href: '/dashboard/templates', icon: '📝' },
  { name: 'Appareils', href: '/dashboard/devices', icon: '📱' },
  { name: 'Opt-outs', href: '/dashboard/optouts', icon: '🚫' },
  { name: 'Profil', href: '/dashboard/profile', icon: '👤' },
  { name: 'Facturation', href: '/billing/plans', icon: '💳' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Tracking: ping une fois quand l'utilisateur ouvre le dashboard
  useEffect(() => {
    try {
      fetch('/api/track/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        keepalive: true,
      }).catch(() => {})
    } catch (_) {}
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full bg-card border-r border-border flex flex-col shadow-sm">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-xl shadow-sm group-hover:shadow-md transition-shadow">
                📱
              </div>
              <div>
                <h1 className="font-semibold text-lg text-primary">SMS Gateway</h1>
                <p className="text-xs text-muted-foreground">Plateforme SaaS</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="text-xl">
                    {item.icon}
                  </span>
                  <span className="text-sm">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <a
              href="/auth/logout"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <span className="text-xl">🚪</span>
              <span>Déconnexion</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {/* Theme toggle placeholder */}
              <button className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
                🌙
              </button>
              
              {/* Notifications placeholder */}
              <button className="relative p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
                🔔
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

