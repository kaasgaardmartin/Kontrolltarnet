import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { hentHoringerForSak } from '@/app/api/stortinget/route'

// ============================================================
// Samlet cron-jobb for høringer (kjøres daglig kl. 06:00)
//
// Del 1: Oppdater høringer fra Stortingets API for alle aktive saker
// Del 2: Trigger Supabase Edge Function for regjeringen.no-scraping
//        (Edge Function kjører på Deno Deploy / Cloudflare, som ikke
//         blokkeres av regjeringen.no sin WAF slik Vercel-IP-er gjør)
// ============================================================

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

async function oppdaterStortingshoringer(supabase: Awaited<ReturnType<typeof createServiceRoleClient>>) {
  const { data: saker, error } = await supabase
    .from('saker')
    .select('id, organisasjon_id, stortingssak_ref, tittel')
    .eq('niva', 'storting')
    .not('stortingssak_ref', 'is', null)

  if (error) {
    console.error('[cron/oppdater-horinger] Feil ved henting av saker:', error)
    return { antall_saker: 0, antall_oppdatert: 0, antall_nye: 0, feil: [error.message] }
  }

  if (!saker || saker.length === 0) {
    return { antall_saker: 0, antall_oppdatert: 0, antall_nye: 0, feil: [] }
  }

  let antallOppdatert = 0
  let antallNyeHoringer = 0
  const feil: string[] = []

  for (const sak of saker) {
    const stortingsSakId = extractStortingsSakId(sak.stortingssak_ref)
    if (!stortingsSakId) continue

    try {
      const horinger = await hentHoringerForSak(stortingsSakId)
      if (horinger.length === 0) continue

      const { data: eksisterende } = await supabase
        .from('horinger')
        .select('horing_id')
        .eq('sak_id', sak.id)

      const eksisterendeIds = new Set((eksisterende ?? []).map((h: { horing_id: string }) => h.horing_id))
      const nyeHoringer = horinger.filter(h => !eksisterendeIds.has(h.horing_id))

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
            `[cron/oppdater-horinger] ${nyeHoringer.length} ny(e) høring(er) for "${sak.tittel}" (${stortingsSakId})`
          )
        }
      }
    } catch (err) {
      console.error(`[cron/oppdater-horinger] Feil for sak ${sak.id}:`, err)
      feil.push(`${sak.id}: ${err instanceof Error ? err.message : 'Ukjent feil'}`)
    }
  }

  return { antall_saker: saker.length, antall_oppdatert: antallOppdatert, antall_nye: antallNyeHoringer, feil }
}

async function triggerOffentligeHoringer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Mangler SUPABASE_URL eller SERVICE_ROLE_KEY')
  }

  const resp = await fetch(
    `${supabaseUrl}/functions/v1/hent-offentlige-horinger`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(90_000),
    }
  )

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Edge function feilet: HTTP ${resp.status} — ${body}`)
  }

  return await resp.json()
}

export async function GET(request: NextRequest) {
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

  // Del 1: Stortinget-høringer
  const storting = await oppdaterStortingshoringer(supabase)
  console.log(
    `[cron/oppdater-horinger] Storting: ${storting.antall_oppdatert}/${storting.antall_saker} saker, ${storting.antall_nye} nye høringer`
  )

  // Del 2: Offentlige høringer via Supabase Edge Function
  let offentlige = { antall_funnet: 0, antall_nye: 0 }
  try {
    offentlige = await triggerOffentligeHoringer()
    console.log(
      `[cron/oppdater-horinger] Regjeringen.no: ${offentlige.antall_nye} nye av ${offentlige.antall_funnet} funnet`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil'
    console.error('[cron/oppdater-horinger] Edge function feilet:', msg)
    storting.feil.push(`regjeringen.no: ${msg}`)
  }

  return NextResponse.json({
    melding: 'Høringer oppdatert',
    storting: {
      antall_saker: storting.antall_saker,
      antall_oppdatert: storting.antall_oppdatert,
      antall_nye: storting.antall_nye,
    },
    offentlige,
    feil: storting.feil.length > 0 ? storting.feil : undefined,
  })
}
