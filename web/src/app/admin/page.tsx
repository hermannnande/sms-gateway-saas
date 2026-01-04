'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/admin/stat-card'
import { ChartWrapper } from '@/components/admin/chart-wrapper'
import { PageHeader } from '@/components/admin/page-header'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
        <p className="font-semibold">Erreur</p>
        <p className="text-sm">{error || 'Impossible de charger les données'}</p>
      </div>
    )
  }

  const { kpis } = data

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Dashboard Admin" 
        description="Vue d'ensemble de la plateforme en temps réel"
      />

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Utilisateurs inscrits"
          value={kpis.usersTotal}
          subtitle="Total"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        
        <StatCard
          title="Organisations"
          value={kpis.orgsTotal}
          subtitle="Actives"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />

        <StatCard
          title="Appareils connectés"
          value={kpis.devicesTotal}
          subtitle="Total"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />

        <StatCard
          title="Téléchargements APK"
          value={kpis.downloadsMonth}
          subtitle={`Aujourd'hui: ${kpis.downloadsToday}`}
          change={`+${kpis.downloadsToday} aujourd'hui`}
          changeType="positive"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }
        />
      </div>

      {/* KPIs secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Messages envoyés"
          value={kpis.messagesTotal.toLocaleString()}
          subtitle={`Aujourd'hui: ${kpis.messagesToday.toLocaleString()}`}
          change={`+${kpis.messagesToday} aujourd'hui`}
          changeType="positive"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          }
        />

        <StatCard
          title="Abonnements actifs"
          value={kpis.activeSubscriptions}
          subtitle="Plans payants + gratuits"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWrapper title="Téléchargements APK (7 derniers jours)" subtitle="Évolution quotidienne">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.downloads}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartWrapper>

        <ChartWrapper title="Nouveaux utilisateurs (7 derniers jours)" subtitle="Inscriptions">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.users}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>

      <ChartWrapper title="SMS envoyés (7 derniers jours)" subtitle="Volume quotidien">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.charts.messages}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#10b981" name="Messages" />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}
