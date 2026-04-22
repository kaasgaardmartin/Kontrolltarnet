import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide } from '@/lib/horing-scrape'

// POST /api/backfill-publisert-dato
// Scraper regjeringen.no for alle høringer som mangler publisert_dato

export const maxDuration = 60

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { data: bruker } = await supabase
    .from('brukere')
    .select('organisasjon_id, rolle')
    .eq('id', user.id)
    .single()

  if (!bruker) return NextResponse.json({ error: 'Bruker ikke funnet' }, { status: 404 })
  if (bruker.rolle === 'leser') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })

  // Hent alle høringer med URL men uten publisert_dato
  const { data: horinger, error } = await supabase
    .from('offentlige_horinger')
    .select('id, regjeringen_url, tittel')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .not('regjeringen_url', 'is', null)
    .is('publisert_dato', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!horinger || horinger.length === 0) {
    return NextResponse.json({ success: true, antall: 0, oppdatert: 0, melding: 'Ingen høringer mangler dato' })
  }

  let oppdatert = 0
  let feil = 0
  let ingenDato = 0

  // Kjør i batches på 3 for å ikke overbelaste regjeringen.no
  for (let i = 0; i < horinger.length; i += 3) {
    const batch = horinger.slice(i, i + 3)
    await Promise.all(batch.map(async (h) => {
      try {
        const resultat = await skrapRegjeringenSide(h.regjeringen_url!)
        if (resultat.publisert_dato) {
          await supabase
            .from('offentlige_horinger')
            .update({ publisert_dato: resultat.publisert_dato })
            .eq('id', h.id)
          oppdatert++
        } else {
          ingenDato++
        }
      } catch {
        feil++
      }
    }))
  }

  return NextResponse.json({
    success: true,
    antall: horinger.length,
    oppdatert,
    ingen_dato: ingenDato,
    feil,
  })
}
