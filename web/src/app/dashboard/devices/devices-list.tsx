'use client'

type Device = {
  id: string
  name: string
  selected_subscription_id: string | null
  last_seen_at: string | null
  status: string
  created_at: string
}

export function DevicesList({ devices }: { devices: Device[] }) {
  if (devices.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-16 text-center border-4 border-black/10 dark:border-white/10 animate-fade-in">
        <div className="text-7xl mb-6 animate-float">📱</div>
        <h3 className="text-2xl font-black mb-3">Aucun appareil connecté</h3>
        <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
          Ajoutez votre premier appareil Android pour commencer à envoyer des SMS
        </p>
        <div className="inline-block px-6 py-3 bg-primary/10 border-2 border-primary/30 rounded-xl">
          <p className="text-sm font-semibold text-primary">
            💡 Cliquez sur "Ajouter un appareil" pour scanner le QR code
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {devices.map((device) => {
        const isOnline = device.status === 'online' && 
          device.last_seen_at && 
          (Date.now() - new Date(device.last_seen_at).getTime()) < 5 * 60 * 1000 // 5 min

        return (
          <div
            key={device.id}
            className={`glass-card rounded-2xl p-6 border-4 hover-lift group animate-fade-in ${
              isOnline 
                ? 'border-green-500/30 bg-green-500/5' 
                : 'border-black/10 dark:border-white/10'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl group-hover:scale-110 transition-transform">📱</span>
                <div>
                  <h3 className="font-black text-xl group-hover:text-primary transition">{device.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-bold border-2 mt-2 ${
                      isOnline
                        ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30'
                        : 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse-glow' : 'bg-gray-500'}`}></span>
                    {isOnline ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {device.selected_subscription_id && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xl">📶</span>
                  <span className="font-semibold text-muted-foreground">SIM:</span>
                  <span className="font-mono bg-background/50 px-2 py-1 rounded border border-border">
                    {device.selected_subscription_id}
                  </span>
                </div>
              )}
              {device.last_seen_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xl">⏰</span>
                  <span className="font-semibold">Dernière activité:</span>
                  <span>{new Date(device.last_seen_at).toLocaleString('fr-FR')}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-xl">📅</span>
                <span className="font-semibold">Ajouté le:</span>
                <span>{new Date(device.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}


