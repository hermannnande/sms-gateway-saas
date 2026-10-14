import type { SupabaseClient } from '@supabase/supabase-js'

export type CampaignStats = {
  campaign_id: string
  total: number
  queued: number
  sending: number
  sent: number
  failed: number
  skipped_optout: number
  delivered: number
  delivery_pending: number
  delivery_failed: number
  delivery_unknown: number
}

export async function campaignStats(client: SupabaseClient, ids: string[]): Promise<CampaignStats[]> {
  if (!ids.length) return []
  const { data, error } = await client.rpc('campaign_message_stats', { p_campaign_ids: ids })
  if (error) throw new Error('Statistiques de réception indisponibles. Réessayez après la mise à jour du serveur.')
  return (data ?? []) as CampaignStats[]
}

export function deliveryLabel(status: string | null, sendStatus: string) {
  if (sendStatus !== 'sent') return '—'
  if (status === 'delivered') return 'Livré'
  if (status === 'failed') return 'Non livré (confirmé)'
  if (status === 'pending') return 'Accusé en attente'
  return 'Sans suivi'
}
