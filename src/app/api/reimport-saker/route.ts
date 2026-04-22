import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hentSakDetaljer, hentHoringerForSak } from '@/app/api/stortinget/route'

// POST /api/reimport-saker
// Henter ferske data fra Stortinget for de 20 nyeste sakene og oppdaterer databasen

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { data: bruker } = await supabase
    .from('brukere')
    .select('organisasjon_id, rolle')
    .eq('auth_id', user.id)
    .single()

  if (!bruker) return NextResponse.json({ error: 'Bruker ikke funnet' }, { status: 404 })
  if (bruker.rolle === 'leser') return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })

  // Hent de 20 nyeste sakene med en Stortinget-referanse
  const { data: saker, error } = await supabase
    .from('saker')
    .select('id, stortingssak_ref, tittel')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .not('stortingssak_ref', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !saker) {
    return NextResponse.json({ error: 'Kunne ikke hente saker fra databasen' }, { status: 500 })
  }

  const resultater: { id: string; tittel: string; status: string; horinger?: number }[] = []

  // Kjør i batches på 3 for å ikke overbelaste Stortingets API
  for (let i = 0; i < saker.length; i += 3) {
    const batch = saker.slice(i, i + 3)
    const batchRes = await Promise.all(batch.map(async (sak) => {
      try {
        const detaljer = await hentSakDetaljer(sak.stortingssak_ref!)
        if (!detaljer) return { id: sak.id, tittel: sak.tittel ?? '', status: 'ikke_funnet' }

        await supabase
          .from('saker')
          .update({
            komite_dato: detaljer.innstilling_dato,
            stortings_dato: detaljer.behandling_dato,
          })
          .eq('id', sak.id)

        // Oppdater høringer
        const horinger = await hentHoringerForSak(sak.stortingssak_ref!)
        if (horinger.length > 0) {
          await supabase
            .from('horinger')
            .upsert(
              horinger.map(h => ({
                sak_id: sak.id,
                organisasjon_id: bruker.organisasjon_id,
                horing_id: h.horing_id,
                tittel: h.tittel,
                skriftlig: h.skriftlig,
                innspillsfrist: h.innspillsfrist,
                anmodningsfrist: h.anmodningsfrist,
                start_dato: h.start_dato,
                status: h.status,
              })),
              { onConflict: 'sak_id,horing_id' }
            )
        }

        return { id: sak.id, tittel: sak.tittel ?? '', status: 'oppdatert', horinger: horinger.length }
      } catch {
        return { id: sak.id, tittel: sak.tittel ?? '', status: 'feil' }
      }
    }))
    resultater.push(...batchRes)
  }

  return NextResponse.json({
    success: true,
    antall: saker.length,
    oppdatert: resultater.filter(r => r.status === 'oppdatert').length,
    feil: resultater.filter(r => r.status === 'feil').length,
    resultater,
  })
}
