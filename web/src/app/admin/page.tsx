'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DashboardData {
  kpis: {
    usersTotal: number
    orgsTotal: number
    devicesTotal: number
    downloadsMonth: number
    downloadsToday: number
    messagesTotal: number
    messagesToday: number
    activeSubscriptions: number
  }
  charts: {
    downloads: Array<{ date: string; count: number }>
    users: Array<{ date: string; count: number }>
    messages: Array<{ date: string; count: number }>
  }
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
  meta?: Record<string, any>
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/metrics').then((r) => r.json()),
      fetch('/api/admin/activity?limit=15').then((r) => r.json()),
    ])
      .then(([metricsJson, activityJson]) => {
        if (metricsJson.error) throw new Error(metricsJson.error)
        setData(metricsJson)
        if (activityJson.ok) setActivity(activityJson.items || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
        <p className="font-semibold">Erreur</p>
        <p className="text-sm">{error || 'Impossible de charger les donnees'}</p>
      </div>
    )
  }

  const { kpis } = data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Vue d&apos;ensemble de la plateforme en temps reel</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Utilisateurs"
          value={kpis.usersTotal}
          icon={<UsersIcon />}
          color="blue"
          href="/admin/users"
        />
        <KpiCard
          label="Appareils"
          value={kpis.devicesTotal}
          icon={<PhoneIcon />}
          color="emerald"
          href="/admin/devices-stats"
        />
        <KpiCard
          label="SMS envoyes"
          value={kpis.messagesTotal}
          subtitle={`+${kpis.messagesToday} aujourd'hui`}
          icon={<MessageIcon />}
          color="violet"
          href="/admin/sms-stats"
        />
        <KpiCard
          label="Telechargements"
          value={kpis.downloadsMonth}
          subtitle={`+${kpis.downloadsToday} aujourd'hui`}
          icon={<DownloadIcon />}
          color="amber"
          href="/admin/traffic"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKpi label="Organisations" value={kpis.orgsTotal} />
        <MiniKpi label="Abonnements actifs" value={kpis.activeSubscriptions} />
        <MiniKpi label="SMS aujourd'hui" value={kpis.messagesToday} highlight />
        <MiniKpi label="Telechargements aujourd'hui" value={kpis.downloadsToday} highlight />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Charts (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          <ChartCard title="SMS envoyes" subtitle="7 derniers jours" color="#10b981">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.messages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Messages" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Nouveaux utilisateurs" subtitle="7 derniers jours" color="#3b82f6" height={200}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.users}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Telechargements APK" subtitle="7 derniers jours" color="#8b5cf6" height={200}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.downloads}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        {/* Activity Feed (1/3) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Activite recente</h3>
              <p className="text-xs text-gray-400 mt-0.5">Dernieres actions</p>
            </div>
            <Link
              href="/admin/activity"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Voir tout &rarr;
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {activity.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Aucune activite</div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activityIconBg(item.color)}`}>
                      {activityIconSvg(item.icon, item.color)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate">{item.description}</p>
                    </div>
                    <span className="text-[10px] text-gray-300 font-medium shrink-0 pt-0.5">
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'maintenant'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}j`
}

function activityIconBg(color: string) {
  const map: Record<string, string> = {
    blue: 'bg-blue-50',
    emerald: 'bg-emerald-50',
    purple: 'bg-purple-50',
    orange: 'bg-orange-50',
    red: 'bg-red-50',
    gray: 'bg-gray-50',
  }
  return map[color] || map.gray
}

function activityIconSvg(icon: string, color: string) {
  const colorClass: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    red: 'text-red-500',
    gray: 'text-gray-400',
  }
  const cls = `w-4 h-4 ${colorClass[color] || colorClass.gray}`

  switch (icon) {
    case 'user-plus':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    case 'smartphone':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      )
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )
  }
}

/* ── KPI Card ── */
interface KpiCardProps {
  label: string
  value: number
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'violet' | 'amber'
  href: string
}

const kpiColors = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
}

function KpiCard({ label, value, subtitle, icon, color, href }: KpiCardProps) {
  const c = kpiColors[color]
  return (
    <Link href={href} className="group">
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center ${c.text}`}>
            {icon}
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString('fr-FR')}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {subtitle && <p className="text-xs text-emerald-600 font-medium mt-0.5">{subtitle}</p>}
      </div>
    </Link>
  )
}

/* ── Mini KPI ── */
function MiniKpi({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>
        {value.toLocaleString('fr-FR')}
      </span>
    </div>
  )
}

/* ── Chart Card ── */
function ChartCard({ title, subtitle, children, color, height = 280 }: {
  title: string; subtitle: string; children: React.ReactNode; color: string; height?: number
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 ml-[18px]">{subtitle}</p>
      </div>
      <div className="p-4" style={{ height }}>
        {children}
      </div>
    </div>
  )
}

/* ── Icons ── */
function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}
