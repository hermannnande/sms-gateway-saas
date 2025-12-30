import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OptoutsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user's org_id
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  // Get optouts
  const { data: optouts } = orgMember ? await supabase
    .from('optouts')
    .select('*')
    .eq('org_id', orgMember.org_id)
    .order('created_at', { ascending: false }) : { data: [] }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Opt-outs (STOP)
        </h1>
        <p className="text-muted-foreground">
          <span className="font-semibold text-red-600">{optouts?.length || 0}</span> numéro{(optouts?.length || 0) > 1 ? 's' : ''} en liste noire
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
          <div className="text-4xl">ℹ️</div>
          <div>
            <p className="font-semibold text-blue-900 mb-1">Protection anti-spam active</p>
            <p className="text-sm text-blue-700">
              Les numéros qui répondent "STOP" sont automatiquement ajoutés
            </p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-center gap-4">
          <div className="text-4xl">⚠️</div>
          <div>
            <p className="font-semibold text-yellow-900 mb-1">Messages bloqués</p>
            <p className="text-sm text-yellow-700">
              Ces numéros ne recevront plus de SMS
            </p>
          </div>
        </div>
      </div>

      {/* Optouts list */}
      {optouts && optouts.length > 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Liste des opt-outs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/20 border-b border-border">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Raison</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {optouts.map((optout) => (
                  <tr 
                    key={optout.id} 
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-foreground flex items-center gap-2">
                        <span className="text-xl">📵</span>
                        {optout.phone_e164}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{optout.reason || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">
                          {new Date(optout.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(optout.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-16 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
            <span className="text-5xl">🚫</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucun opt-out</h3>
          <p className="text-muted-foreground">
            Tous vos contacts peuvent recevoir des SMS
          </p>
        </div>
      )}
    </div>
  )
}
