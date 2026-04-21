import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const LISTE_URL = 'https://www.regjeringen.no/no/dokument/hoyringar/id1763/'

// ---- Hjelpefunksjoner ----

function parseNorskDato(str: string): string | null {
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function rensk(str: string): string {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

interface HoringListeItem {
  tittel: string
  regjeringen_url: string
  departement: string | null
  publisert_dato: string | null
  horingsfrist: string | null
}

// ---- Parser for regjeringen.no høringsliste ----

async function hentHoringerFraListe(): Promise<HoringListeItem[]> {
  const resp = await fetch(LISTE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Kontrolltarnet/1.0)',
      'Accept-Language': 'nb-NO,nb;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fra regjeringen.no`)
  const html = await resp.text()

  const resultater: HoringListeItem[] = []

  // Finn alle lenker til dokumenter-sider (høringer har URL /no/dokumenter/horing-...)
  // Strategien: finn alle href som matcher høring-URL-mønsteret, og plukk kontekst rundt dem
  const lenkeMønster = /href="(\/no\/dokumenter\/[^"]+\/id\d+\/[^"]*)"/gi
  let lenkeMatch: RegExpExecArray | null

  while ((lenkeMatch = lenkeMønster.exec(html)) !== null) {
    const relUrl = lenkeMatch[1]
    const fullUrl = `https://www.regjeringen.no${relUrl}`

    // Unngå duplikater
    if (resultater.some(r => r.regjeringen_url === fullUrl)) continue

    // Finn konteksten rundt lenken — ca 800 tegn bakover
    const startPos = Math.max(0, lenkeMatch.index - 800)
    const kontekst = html.substring(startPos, lenkeMatch.index + lenkeMatch[0].length + 400)

    // Tittel: teksten inne i <a href="...">[tittel]</a>
    const titelMatch = html.substring(lenkeMatch.index).match(/^[^>]+>([\s\S]*?)<\/a>/)
    if (!titelMatch) continue
    const tittel = rensk(titelMatch[1])
    if (!tittel || tittel.length < 5) continue

    // Høringsfrist: "Høringsfrist: DD.MM.YYYY" eller "Frist: DD.MM.YYYY"
    const fristMatch = kontekst.match(/[Hh]øringsfrist[^:]*:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)
      ?? kontekst.match(/[Ff]rist[^:]*:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)
    const horingsfrist = fristMatch ? parseNorskDato(fristMatch[1]) : null

    // Publiseringsdato: finn datoer i konteksten, ta den første som ikke er fristen
    const alleDatoer = [...kontekst.matchAll(/(\d{1,2}\.\d{1,2}\.\d{4})/g)]
      .map(m => m[1])
      .filter(d => d !== fristMatch?.[1])
    const publisert_dato = alleDatoer.length > 0 ? parseNorskDato(alleDatoer[0]) : null

    // Departement: finn tekst etter "departement" eller "direktorat" i konteksten
    const deptMatch = kontekst.match(/([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]+(?:departementet|direktoratet|tilsynet|rådet|departement|Statsministerens kontor))/u)
    const departement = deptMatch ? deptMatch[1].replace(/\s+/g, ' ').trim() : null

    resultater.push({
      tittel,
      regjeringen_url: fullUrl,
      departement,
      publisert_dato,
      horingsfrist,
    })
  }

  return resultater
}

// ---- Cron-endepunkt ----

export async function GET(request: NextRequest) {
  // Autentisering med CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server-konfigurasjonsfeil: CRON_SECRET mangler' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
  }

  try {
    const supabase = await createServiceRoleClient()

    // Hent kun organisasjoner med auto-import aktivert
    const { data: orgs, error: orgFeil } = await supabase
      .from('organisasjoner')
      .select('id')
      .eq('auto_import_horinger', true)
    if (orgFeil) throw new Error(`Org-henting feilet: ${orgFeil.message}`)
    if (!orgs?.length) {
      return NextResponse.json({ melding: 'Ingen organisasjoner funnet', antall_nye: 0 })
    }

    // Hent høringer fra regjeringen.no
    const horinger = await hentHoringerFraListe()
    if (!horinger.length) {
      return NextResponse.json({ melding: 'Ingen høringer funnet på listesiden', antall_nye: 0 })
    }

    let totaltNye = 0

    for (const org of orgs) {
      // Hent eksisterende URLs for denne org (unngå duplikater)
      const { data: eksisterende } = await supabase
        .from('offentlige_horinger')
        .select('regjeringen_url')
        .eq('organisasjon_id', org.id)
        .not('regjeringen_url', 'is', null)

      const eksisterendeUrls = new Set(
        (eksisterende ?? []).map(h => h.regjeringen_url as string)
      )

      const nye = horinger.filter(h => !eksisterendeUrls.has(h.regjeringen_url))
      if (!nye.length) continue

      const rader = nye.map(h => ({
        organisasjon_id: org.id,
        tittel: h.tittel,
        departement: h.departement,
        regjeringen_url: h.regjeringen_url,
        publisert_dato: h.publisert_dato,
        horingsfrist: h.horingsfrist,
        status: 'innkommet' as const,
        utvalg: [] as string[],
        horing_instanser: [] as string[],
      }))

      const { error: insertFeil } = await supabase
        .from('offentlige_horinger')
        .insert(rader)

      if (insertFeil) {
        console.error(`Insert feilet for org ${org.id}:`, insertFeil.message)
      } else {
        totaltNye += nye.length
      }
    }

    return NextResponse.json({
      melding: 'Høringer oppdatert',
      antall_funnet_pa_siden: horinger.length,
      antall_nye_totalt: totaltNye,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil'
    console.error('hent-offentlige-horinger feil:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
