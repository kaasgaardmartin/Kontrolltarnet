import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide } from '@/lib/horing-scrape'

export const maxDuration = 60

// ============================================================
// Admin-endepunkt: Re-scrape høringsinstanser for alle
// offentlige_horinger med regjeringen_url
// Sikret med CRON_SECRET
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET mangler' }, { status: 500 })
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const supabase = await createServiceRoleClient()

  const { data: horinger, error } = await supabase
    .from('offentlige_horinger')
    .select('id, regjeringen_url')
    .not('regjeringen_url', 'is', null)
    .neq('status', 'arkivert')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!horinger?.length) return NextResponse.json({ melding: 'Ingen høringer å oppdatere', antall: 0 })

  let oppdatert = 0
  let feil = 0
  const detaljer: string[] = []

  for (const h of horinger) {
    if (!h.regjeringen_url) continue
    try {
      const scraped = await skrapRegjeringenSide(h.regjeringen_url)
      if (scraped.horing_instanser.length === 0) continue

      const { error: updateError } = await supabase
        .from('offentlige_horinger')
        .update({ horing_instanser: scraped.horing_instanser })
        .eq('id', h.id)

      if (updateError) {
        feil++
        detaljer.push(`${h.id}: ${updateError.message}`)
      } else {
        oppdatert++
      }
    } catch (err) {
      feil++
      detaljer.push(`${h.id}: ${err instanceof Error ? err.message : 'Ukjent feil'}`)
    }
  }

  return NextResponse.json({
    melding: 'Re-scrape fullført',
    totalt: horinger.length,
    oppdatert,
    feil,
    ...(detaljer.length > 0 ? { detaljer } : {}),
  })
}
