'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

interface GlobalStats {
  total_messages_all_time: number
  total_sent_all_time: number
  total_failed_all_time: number
  total_today: number
  total_this_month: number
  total_last_30_days: number
  avg_per_day_last_30: number
}

interface DayStats {
  date: string
  total_sent: number
  total_failed: number
  total_messages: number
}

interface MonthStats {
  month: string
  year: number
  total_sent: number
  total_failed: number
  total_messages: number
}

interface TopOrg {
  org_id: string
  org_name: string
  total_sent: number
  total_failed: number
  success_rate: number
}

type ViewMode = 'day' | 'month'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function SMSStatsPage() {
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [dayStats, setDayStats] = useState<DayStats[]>([])
  const [monthStats, setMonthStats] = useState<MonthStats[]>([])
  const [topOrgs, setTopOrgs] = useState<TopOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [days, setDays] = useState(30)

  useEffect(() => {
    loadAllStats()
  }, [days, viewMode])

  async function loadAllStats() {
    setLoading(true)
    try {
      const [globalRes, dayRes, monthRes, topOrgsRes] = await Promise.all([
        fetch('/api/admin/sms-stats?type=global'),
        fetch(`/api/admin/sms-stats?type=by_day&days=${days}`),
        fetch('/api/admin/sms-stats?type=by_month&months=12'),
        fetch(`/api/admin/sms-stats?type=top_orgs&limit=10&days=${days}`),
      ])

      const [globalJson, dayJson, monthJson, topOrgsJson] = await Promise.all([
        globalRes.json(),
        dayRes.json(),
        monthRes.json(),
        topOrgsRes.json(),
      ])

      if (globalJson.ok && globalJson.data?.[0]) setGlobalStats(globalJson.data[0])
      if (dayJson.ok) setDayStats(dayJson.data || [])
      if (monthJson.ok) setMonthStats(monthJson.data || [])
      if (topOrgsJson.ok) setTopOrgs(topOrgsJson.data || [])
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = viewMode === 'day' 
    ? dayStats.map(d => ({
        name: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        'Envoyés': d.total_sent,
        'Échoués': d.total_failed,
        Total: d.total_messages,
      })).reverse()
    : monthStats.map(m => ({
        name: `${m.month.substring(0, 3)} ${m.year}`,
        'Envoyés': m.total_sent,
        'Échoués': m.total_failed,
        Total: m.total_messages,
      })).reverse()

  const topOrgsPieData = topOrgs.slice(0, 6).map(org => ({
    name: org.org_name.length > 20 ? org.org_name.substring(0, 20) + '...' : org.org_name,
    value: org.total_sent,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="📊 Statistiques SMS" description="Vue d'ensemble de l'utilisation des SMS" />

      {/* Statistiques globales */}
      {globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total (all time)"
            value={globalStats.total_messages_all_time.toLocaleString('fr-FR')}
            subtitle="messages"
            color="blue"
          />
          <StatCard
            title="Aujourd'hui"
            value={globalStats.total_today.toLocaleString('fr-FR')}
            subtitle="messages"
            color="green"
          />
          <StatCard
            title="Ce mois"
            value={globalStats.total_this_month.toLocaleString('fr-FR')}
            subtitle="messages"
            color="purple"
          />
          <StatCard
            title="Moyenne / jour (30j)"
            value={Math.round(globalStats.avg_per_day_last_30).toLocaleString('fr-FR')}
            subtitle="messages/jour"
            color="orange"
          />
        </div>
      )}

      {/* Taux de succès global */}
      {globalStats && globalStats.total_messages_all_time > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Taux de réussite global</h3>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="text-4xl font-bold text-green-600">
                {((globalStats.total_sent_all_time / globalStats.total_messages_all_time) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {globalStats.total_sent_all_time.toLocaleString('fr-FR')} envoyés sur{' '}
                {globalStats.total_messages_all_time.toLocaleString('fr-FR')}
              </div>
            </div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600"
                  style={{
                    width: `${(globalStats.total_sent_all_time / globalStats.total_messages_all_time) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>✅ Succès: {globalStats.total_sent_all_time.toLocaleString('fr-FR')}</span>
                <span>❌ Échecs: {globalStats.total_failed_all_time.toLocaleString('fr-FR')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graphique principal */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Évolution des envois SMS</h3>
          <div className="flex gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={7}>7 derniers jours</option>
              <option value={30}>30 derniers jours</option>
              <option value={90}>90 derniers jours</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'day'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Par jour
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Par mois
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="Envoyés"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorSent)"
              />
              <Area
                type="monotone"
                dataKey="Échoués"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorFailed)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top organisations + Répartition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top organisations */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">🏆 Top 10 organisations ({days} derniers jours)</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {topOrgs.map((org, idx) => (
                <div key={org.org_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{org.org_name}</div>
                    <div className="text-xs text-gray-500">
                      {org.total_sent.toLocaleString('fr-FR')} envoyés • {org.success_rate}% succès
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold text-green-600">
                      {org.total_sent.toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Répartition par organisation (pie chart) */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">📈 Répartition des SMS (Top 6)</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topOrgsPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {topOrgsPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-80 mb-1">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs opacity-70 mt-1">{subtitle}</div>
    </div>
  )
}

