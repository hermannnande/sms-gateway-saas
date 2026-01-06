'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTable } from '@/components/admin/admin-table'
import { Filters } from '@/components/admin/filters'

interface GlobalDeviceStats {
  total_devices: number
  active_devices: number
  online_devices: number
  devices_with_geo: number
  unique_countries: number
  unique_cities: number
}

interface DeviceStats {
  device_id: string
  device_name: string
  org_id: string
  org_name: string
  total_sent: number
  total_failed: number
  success_rate: number
  last_seen_at: string | null
  country: string | null
  city: string | null
  app_version: string | null
  status: string
}

interface CountryStats {
  country: string
  device_count: number
  active_devices: number
  total_sent: number
}

export default function DevicesStatsPage() {
  const [globalStats, setGlobalStats] = useState<GlobalDeviceStats | null>(null)
  const [devices, setDevices] = useState<DeviceStats[]>([])
  const [countries, setCountries] = useState<CountryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [searchTerm, setSearchTerm] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')

  useEffect(() => {
    loadAllStats()
  }, [days])

  async function loadAllStats() {
    setLoading(true)
    try {
      const [globalRes, devicesRes, countriesRes] = await Promise.all([
        fetch('/api/admin/device-stats?type=global'),
        fetch(`/api/admin/device-stats?type=devices&days=${days}`),
        fetch('/api/admin/device-stats?type=by_country'),
      ])

      const [globalJson, devicesJson, countriesJson] = await Promise.all([
        globalRes.json(),
        devicesRes.json(),
        countriesRes.json(),
      ])

      if (globalJson.ok && globalJson.data?.[0]) setGlobalStats(globalJson.data[0])
      if (devicesJson.ok) setDevices(devicesJson.data || [])
      if (countriesJson.ok) setCountries(countriesJson.data || [])
    } catch (err) {
      console.error('Error loading device stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      searchTerm === '' ||
      d.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.org_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.city || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCountry = countryFilter === 'all' || d.country === countryFilter

    return matchesSearch && matchesCountry
  })

  const uniqueCountries = Array.from(new Set(devices.map((d) => d.country).filter(Boolean)))

  const columns = [
    {
      header: 'Appareil',
      accessor: (row: DeviceStats) => (
        <div>
          <div className="font-medium text-gray-900">{row.device_name}</div>
          <div className="text-xs text-gray-500">{row.org_name}</div>
        </div>
      ),
    },
    {
      header: 'Localisation',
      accessor: (row: DeviceStats) =>
        row.city && row.country ? (
          <div>
            <div className="text-sm text-gray-900">{row.city}</div>
            <div className="text-xs text-gray-500">{row.country}</div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      header: 'Version APK',
      accessor: (row: DeviceStats) => row.app_version || <span className="text-gray-400">—</span>,
    },
    {
      header: 'SMS envoyés',
      accessor: (row: DeviceStats) => (
        <span className="font-semibold text-green-600">{row.total_sent.toLocaleString('fr-FR')}</span>
      ),
    },
    {
      header: 'Taux succès',
      accessor: (row: DeviceStats) => (
        <span
          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            row.success_rate >= 95
              ? 'bg-green-100 text-green-800'
              : row.success_rate >= 80
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {row.success_rate}%
        </span>
      ),
    },
    {
      header: 'Statut',
      accessor: (row: DeviceStats) => {
        const isOnline = row.status === 'online'
        const isRecent = row.last_seen_at && new Date(row.last_seen_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        return (
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              isOnline && isRecent
                ? 'bg-green-100 text-green-800'
                : isRecent
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isOnline && isRecent ? '🟢 En ligne' : isRecent ? '🟡 Actif' : '⚫ Inactif'}
          </span>
        )
      },
    },
    {
      header: 'Dernière activité',
      accessor: (row: DeviceStats) =>
        row.last_seen_at ? (
          <span className="text-sm text-gray-600">{new Date(row.last_seen_at).toLocaleString('fr-FR')}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="📱 Statistiques par appareil" description="Vue détaillée de chaque appareil et sa localisation" />

      {/* Stats globales */}
      {globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total appareils" value={globalStats.total_devices.toString()} icon="📱" color="blue" />
          <StatCard title="Actifs (24h)" value={globalStats.active_devices.toString()} icon="✅" color="green" />
          <StatCard title="En ligne" value={globalStats.online_devices.toString()} icon="🟢" color="emerald" />
          <StatCard title="Géolocalisés" value={globalStats.devices_with_geo.toString()} icon="🌍" color="purple" />
          <StatCard title="Pays" value={globalStats.unique_countries.toString()} icon="🗺️" color="orange" />
          <StatCard title="Villes" value={globalStats.unique_cities.toString()} icon="🏙️" color="pink" />
        </div>
      )}

      {/* Répartition par pays */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">🌍 Répartition géographique</h3>
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {countries.slice(0, 6).map((c) => (
              <div key={c.country} className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.country}</div>
                  <div className="text-xs text-gray-500">
                    {c.device_count} appareil{c.device_count > 1 ? 's' : ''} • {c.active_devices} actif
                    {c.active_devices > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">{c.device_count}</div>
                  <div className="text-xs text-gray-500">{c.total_sent.toLocaleString('fr-FR')} SMS</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtres */}
      <Filters
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par nom, organisation, ville..."
        filters={[
          {
            label: 'Période',
            value: String(days),
            onChange: (v) => setDays(Number(v)),
            options: [
              { label: '7 derniers jours', value: '7' },
              { label: '30 derniers jours', value: '30' },
              { label: '90 derniers jours', value: '90' },
            ],
          },
          {
            label: 'Pays',
            value: countryFilter,
            onChange: setCountryFilter,
            options: [
              { label: 'Tous les pays', value: 'all' },
              ...uniqueCountries.map((c) => ({ label: c || 'Inconnu', value: c || '' })),
            ],
          },
        ]}
      />

      {/* Tableau des appareils */}
      <AdminTable
        data={filteredDevices}
        columns={columns}
        loading={loading}
        emptyMessage="Aucun appareil trouvé"
      />
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: string
  color: 'blue' | 'green' | 'emerald' | 'purple' | 'orange' | 'pink'
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium opacity-80">{title}</div>
        <div className="text-2xl">{icon}</div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

