import { createClient } from '@/lib/supabase/server'
import { campaignExportRow } from '@/lib/campaign-export'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Campagne invalide', { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Connexion requise', { status: 401 })
  // Both campaign and message reads use the user's session and tenant RLS.
  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', id).single()
  if (!campaign) return new Response('Campagne introuvable', { status: 404 })

  const page = (after?: string) => {
    let query = supabase.from('messages')
      .select('id, to_phone_e164, body_final, status, sent_at, last_error')
      .eq('campaign_id', id).order('id').limit(500)
    if (after) query = query.gt('id', after)
    return query
  }
  const first = await page()
  if (first.error) return new Response('Export indisponible', { status: 503 })
  let rows = first.data ?? []
  let header = true
  let finished = false
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) { controller.close(); return }
      if (header) {
        controller.enqueue(encoder.encode('\uFEFFTéléphone;Message;Statut;Date envoi;Erreur\r\n'))
        header = false
      }
      controller.enqueue(encoder.encode(rows.map(campaignExportRow).join('')))
      if (rows.length < 500) { finished = true; controller.close(); return }
      const next = await page(rows[rows.length - 1].id)
      if (next.error) { controller.error(new Error('Export interrompu')); return }
      rows = next.data ?? []
    },
  })
  return new Response(stream, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="campagne-${id}.csv"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}
