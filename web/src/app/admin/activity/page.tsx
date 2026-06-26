'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/admin/page-header'

interface ActivityItem {
  id: string
  type: 'signup' | 'device' | 'campaign' | 'download'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
  meta?: Record<string, any>
}

interface Counts {
  signup: number
  device: number
  campaign: number
  download: number
}

const typeFilters = [
  { key: 'all', label: 'Tout', icon: '⚡' },
  { key: 'signup', label: 'Inscriptions', icon: '👤' },
  { key: 'device', label: 'Appareils', icon: '📱' },
  { key: 'campaign', label: 'Campagnes', icon: '📣' },
  { key: 'download', label: 'Telechargements', icon: '📥' },
]

export default function AdminActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [counts, setCounts] = useState<Counts>({ signup: 0, device: 0, campaign: 0, download: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '100', type: filter })
      const res = await fetch(`/api/admin/activity?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) {
        setItems(json.items || [])
        setCounts(json.counts || { signup: 0, device: 0, campaign: 0, download: 0 })
        setError(null)
      } else {
        setError(json.error || 'Erreur')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, load])

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'A l\'instant'
    if (mins < 60) return `Il y a ${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Il y a ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `Il y a ${days}j`
    return new Date(ts).toLocaleDateString('fr-FR')
  }

  const iconMap: Record<string, JSX.Element> = {
    'user-plus': (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    smartphone: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    megaphone: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    download: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  }

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  const dotColor: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  }

  const total = counts.signup + counts.device + counts.campaign + counts.download

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Activite recente"
          description="Toutes les actions sur la plateforme en temps reel"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Chargement...
              </span>
            ) : (
              'Actualiser'
            )}
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Auto (30s)
          </label>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'all', label: 'Total', value: total, color: 'text-gray-900', bg: 'bg-white' },
          { key: 'signup', label: 'Inscriptions', value: counts.signup, color: 'text-blue-700', bg: 'bg-blue-50' },
          { key: 'device', label: 'Appareils', value: counts.device, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { key: 'campaign', label: 'Campagnes', value: counts.campaign, color: 'text-orange-700', bg: 'bg-orange-50' },
          { key: 'download', label: 'Telechargements', value: counts.download, color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-xl border p-4 text-left transition-all ${
              filter === c.key
                ? `${c.bg} border-current ring-1 ring-current/20 shadow-sm`
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-xs font-medium text-gray-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${filter === c.key ? c.color : 'text-gray-900'}`}>
              {c.value}
            </p>
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {typeFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Timeline */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p>Aucune activite trouvee</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-1">
            {items.map((item, i) => {
              const prevItem = i > 0 ? items[i - 1] : null
              const currentDate = new Date(item.timestamp).toLocaleDateString('fr-FR')
              const prevDate = prevItem ? new Date(prevItem.timestamp).toLocaleDateString('fr-FR') : null
              const showDateSeparator = currentDate !== prevDate

              return (
                <div key={item.id}>
                  {showDateSeparator && (
                    <div className="relative flex items-center py-3 pl-14">
                      <div className="absolute left-[19px] w-[9px] h-[9px] rounded-full bg-gray-300 border-2 border-white z-10" />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {currentDate === new Date().toLocaleDateString('fr-FR')
                          ? "Aujourd'hui"
                          : currentDate === new Date(Date.now() - 86400000).toLocaleDateString('fr-FR')
                          ? 'Hier'
                          : currentDate}
                      </span>
                    </div>
                  )}

                  <div className="relative flex items-start gap-4 py-2.5 pl-2 pr-4 rounded-xl hover:bg-gray-50/80 transition-colors group">
                    {/* Icon */}
                    <div
                      className={`relative z-10 w-[42px] h-[42px] rounded-xl border flex items-center justify-center shrink-0 ${
                        colorMap[item.color] || colorMap.gray
                      }`}
                    >
                      {iconMap[item.icon] || iconMap.download}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor[item.color] || dotColor.gray}`} />
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-0.5">{item.description}</p>
                      {item.meta?.status && (
                        <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.meta.status === 'online' ? 'bg-emerald-100 text-emerald-700' :
                          item.meta.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          item.meta.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                          item.meta.status === 'canceled' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.meta.status}
                        </span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="text-right shrink-0 pt-0.5">
                      <p className="text-xs text-gray-400 font-medium">{timeAgo(item.timestamp)}</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
