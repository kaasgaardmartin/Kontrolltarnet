import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { hentHoringerForSak } from '@/app/api/stortinget/route'

// ============================================================
// Cron-jobb: Oppdater høringer for alle aktive storting-saker
// Kjøres daglig kl. 06:00 via Vercel Cron (se vercel.json)
// Sikret med CRON_SECRET miljøvariabel
// ============================================================

// Henter Stortingets sak-ID fra en stortingssak_ref URL
// F.eks. "https://www.stortinget.no/...?p=87318" → "87318"
function extractStortingsSakId(ref: string | null): string | null {
  if (!ref) return null
  try {
    const url = new URL(ref)
    const p = url.searchParams.get('p')
    if (p) return p
  } catch { /* ikke en URL */ }
  if (/^\d+$/.test(ref)) return ref
  return null
}

export async function GET(request: NextRequest) {
  // Verifiser cron-secret for å hindre uautorisert tilgang
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[cron/oppdater-horinger] CRON_SECRET er ikke satt')
    return NextResponse.json({ error: 'Server-konfigurasjonsfeil' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Hent alle aktive storting-saker (på tvers av alle organisasjoner)
  const { data: saker, error } = await supabase
    .from('saker')
    .select('id, organisasjon_id, stortingssak_ref, tittel')
    .eq('niva', 'storting')
    .not('stortingssak_ref', 'is', null)

  if (error) {
    console.error('[cron/oppdater-horinger] Feil ved henting av saker:', error)
    return NextResponse.json({ error: 'Databasefeil' }, { status: 500 })
  }

  if (!saker || saker.length === 0) {
    return NextResponse.json({ melding: 'Ingen storting-saker å oppdatere', antall_saker: 0 })
  }

  let antallOppdatert = 0
  let antallNyeHoringer = 0
  const feil: string[] = []

  for (const sak of saker) {
    const stortingsSakId = extractStortingsSakId(sak.stortingssak_ref)
    if (!stortingsSakId) continue

    try {
      // Hent høringer fra Stortingets API
      const horinger = await hentHoringerForSak(stortingsSakId)
      if (horinger.length === 0) continue

      // Sjekk eksisterende høringer for denne saken
      const { data: eksisterende } = await supabase
        .from('horinger')
        .select('horing_id')
        .eq('sak_id', sak.id)

      const eksisterendeIds = new Set((eksisterende ?? []).map((h: { horing_id: string }) => h.horing_id))
      const nyeHoringer = horinger.filter(h => !eksisterendeIds.has(h.horing_id))

      // Upsert alle høringer (oppdaterer eksisterende + legger til nye)
      const rader = horinger.map(h => ({
        sak_id: sak.id,
        organisasjon_id: sak.organisasjon_id,
        horing_id: h.horing_id,
        tittel: h.tittel,
        skriftlig: h.skriftlig,
        innspillsfrist: h.innspillsfrist,
        anmodningsfrist: h.anmodningsfrist,
        start_dato: h.start_dato,
        status: h.status,
      }))

      const { error: upsertError } = await supabase
        .from('horinger')
        .upsert(rader, { onConflict: 'sak_id,horing_id' })

      if (upsertError) {
        console.error(`[cron/oppdater-horinger] Upsert-feil for sak ${sak.id}:`, upsertError)
        feil.push(`${sak.id}: ${upsertError.message}`)
      } else {
        antallOppdatert++
        antallNyeHoringer += nyeHoringer.length

        if (nyeHoringer.length > 0) {
          console.log(
            `[cron/oppdater-horinger] ${nyeHoringer.length} ny(e) høring(er) for "${sak.tittel}" (${stortingsSakId}):`,
            nyeHoringer.map(h => h.horing_id).join(', ')
          )
        }
      }
    } catch (err) {
      console.error(`[cron/oppdater-horinger] Feil for sak ${sak.id}:`, err)
      feil.push(`${sak.id}: ${err instanceof Error ? err.message : 'Ukjent feil'}`)
    }
  }

  console.log(
    `[cron/oppdater-horinger] Ferdig. ${antallOppdatert}/${saker.length} saker oppdatert, ${antallNyeHoringer} nye høringer funnet.`
  )

  return NextResponse.json({
    melding: 'Høringer oppdatert',
    antall_saker_totalt: saker.length,
    antall_saker_oppdatert: antallOppdatert,
    antall_nye_horinger: antallNyeHoringer,
    feil: feil.length > 0 ? feil : undefined,
  })
}
