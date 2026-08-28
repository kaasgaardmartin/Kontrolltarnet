import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { BRREG_BASE, normaliserRoller, finnEndringer } from '@/lib/brreg'
import type { NormalisertRolle, BrregRollegruppe } from '@/lib/brreg'

export const maxDuration = 120

async function hentBrregRoller(orgnr: string): Promise<BrregRollegruppe[]> {
  const resp = await fetch(`${BRREG_BASE}/enheter/${orgnr}/roller`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!resp.ok) {
    throw new Error(`Brreg HTTP ${resp.status} for ${orgnr}`)
  }

  const data = await resp.json()
  return data.rollegrupper ?? []
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sjekk-brreg] CRON_SECRET er ikke satt')
    return NextResponse.json({ error: 'Server-konfigurasjonsfeil' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  const { data: orgListe, error: orgError } = await supabase
    .from('overvakede_organisasjoner')
    .select('id, organisasjon_id, orgnr, navn')
    .eq('aktiv', true)

  if (orgError) {
    console.error('[cron/sjekk-brreg] Feil ved henting av organisasjoner:', orgError)
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  if (!orgListe || orgListe.length === 0) {
    return NextResponse.json({ melding: 'Ingen organisasjoner å sjekke', antall_sjekket: 0 })
  }

  let antallEndringer = 0
  const feil: string[] = []
  const endringerPerOrg = new Map<string, { orgNavn: string; orgnr: string; beskrivelse: string; endringType: string }[]>()

  for (const org of orgListe) {
    try {
      const rollegrupper = await hentBrregRoller(org.orgnr)
      const nyeRoller = normaliserRoller(rollegrupper)

      const { data: snapshot } = await supabase
        .from('brreg_roller_snapshot')
        .select('roller')
        .eq('overvaket_org_id', org.id)
        .single()

      const gamleRoller: NormalisertRolle[] = (snapshot?.roller as NormalisertRolle[]) ?? []
      const endringer = finnEndringer(gamleRoller, nyeRoller, org.navn)

      if (endringer.length > 0) {
        await supabase.from('brreg_endringer').insert(
          endringer.map(e => ({
            overvaket_org_id: org.id,
            organisasjon_id: org.organisasjon_id,
            orgnr: org.orgnr,
            org_navn: org.navn,
            ...e,
          }))
        )

        const { data: brukere } = await supabase
          .from('brukere')
          .select('id')
          .eq('organisasjon_id', org.organisasjon_id)
          .eq('aktiv', true)

        if (brukere && brukere.length > 0) {
          const melding =
            endringer.length === 1
              ? endringer[0].beskrivelse
              : `${endringer.length} endringer oppdaget i ${org.navn}`

          await supabase.from('varsler').insert(
            brukere.map(b => ({
              bruker_id: b.id,
              type: 'organisasjon',
              melding,
            }))
          )
        }

        const liste = endringerPerOrg.get(org.organisasjon_id) ?? []
        for (const e of endringer) {
          liste.push({ orgNavn: org.navn, orgnr: org.orgnr, beskrivelse: e.beskrivelse, endringType: e.endring_type })
        }
        endringerPerOrg.set(org.organisasjon_id, liste)

        antallEndringer += endringer.length
        console.log(
          `[cron/sjekk-brreg] ${endringer.length} endring(er) for ${org.navn} (${org.orgnr})`
        )
      }

      await supabase.from('brreg_roller_snapshot').upsert(
        {
          overvaket_org_id: org.id,
          organisasjon_id: org.organisasjon_id,
          roller: nyeRoller,
          hentet_dato: new Date().toISOString(),
        },
        { onConflict: 'overvaket_org_id' }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil'
      console.error(`[cron/sjekk-brreg] Feil for ${org.navn} (${org.orgnr}):`, msg)
      feil.push(`${org.orgnr}: ${msg}`)
    }
  }

  // Send e-post til brukere med epost_organisasjon=true
  let epostSendt = 0
  if (endringerPerOrg.size > 0) {
    const { sendOrganisasjonsendringEpost } = await import('@/lib/email')

    for (const [orgId, endringer] of endringerPerOrg) {
      const { data: brukere } = await supabase
        .from('brukere')
        .select('navn, epost')
        .eq('organisasjon_id', orgId)
        .eq('aktiv', true)
        .eq('epost_organisasjon', true)

      for (const bruker of brukere ?? []) {
        if (!bruker.epost) continue
        const res = await sendOrganisasjonsendringEpost({
          tilEpost: bruker.epost,
          tilNavn: bruker.navn,
          endringer,
        })
        if (res.success) epostSendt++
        else console.error(`[cron/sjekk-brreg] e-post feilet for ${bruker.epost}:`, res.error)
      }
    }
  }

  console.log(
    `[cron/sjekk-brreg] Ferdig: ${orgListe.length} sjekket, ${antallEndringer} endringer, ${epostSendt} e-poster sendt`
  )

  return NextResponse.json({
    melding: 'Brreg-sjekk fullført',
    antall_sjekket: orgListe.length,
    antall_endringer: antallEndringer,
    epost_sendt: epostSendt,
    feil: feil.length > 0 ? feil : undefined,
  })
}
