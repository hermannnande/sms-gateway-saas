'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: '📊' },
    { name: 'Statistiques SMS', href: '/admin/sms-stats', icon: '📨' },
    { name: 'Statistiques Appareils', href: '/admin/devices-stats', icon: '📱' },
    { name: 'Utilisateurs', href: '/admin/users', icon: '👥' },
    { name: 'Organisations', href: '/admin/orgs', icon: '🏢' },
    { name: 'Abonnements', href: '/admin/subscriptions', icon: '💳' },
    { name: 'Activer Abonnement', href: '/admin/activate', icon: '✅' },
    { name: 'Codes Promo', href: '/admin/promo-codes', icon: '🎟️' },
    { name: 'Trafic', href: '/admin/traffic', icon: '📈' },
    { name: 'Événements', href: '/admin/events', icon: '📋' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Admin</h2>
                <p className="text-xs text-gray-500">Console</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-lg">←</span>
              <span>Retour au dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top bar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Admin</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

