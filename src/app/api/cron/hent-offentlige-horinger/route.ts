import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide } from '@/lib/horing-scrape'

const LISTE_URL = 'https://www.regjeringen.no/no/dokument/hoyringar/id1763/'

// ---- Hjelpefunksjoner ----

function parseNorskDato(str: string): string | null {
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function dekodHtmlEntiteter(str: string): string {
  return str
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&oslash;/gi, 'ø')
    .replace(/&aelig;/gi, 'æ')
    .replace(/&aring;/gi, 'å')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&Aring;/g, 'Å')
}

function rensk(str: string): string {
  return dekodHtmlEntiteter(str.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
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

    // Høringsfrist
    const fristMatch = kontekst.match(/[Hh]øringsfrist[^:]*:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)
      ?? kontekst.match(/[Ff]rist[^:]*:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)
    const horingsfrist = fristMatch ? parseNorskDato(fristMatch[1]) : null

    // Publiseringsdato
    const alleDatoer = [...kontekst.matchAll(/(\d{1,2}\.\d{1,2}\.\d{4})/g)]
      .map(m => m[1])
      .filter(d => d !== fristMatch?.[1])
    const publisert_dato = alleDatoer.length > 0 ? parseNorskDato(alleDatoer[0]) : null

    // Departement
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

// Henter detaljer for en enkelt høring — returnerer null ved feil (for å ikke stoppe hele jobben)
async function hentDetaljer(url: string) {
  try {
    return await skrapRegjeringenSide(url)
  } catch {
    return null
  }
}

// Kjører promises i parallell med maks N samtidige
async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
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

    // Hent høringslisten fra regjeringen.no
    const listeHoringer = await hentHoringerFraListe()
    if (!listeHoringer.length) {
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

      const nye = listeHoringer.filter(h => !eksisterendeUrls.has(h.regjeringen_url))
      if (!nye.length) continue

      // Hent detaljsider for alle nye høringer (maks 3 parallelle for å ikke overbelaste regjeringen.no)
      const detaljTasks = nye.map(h => () => hentDetaljer(h.regjeringen_url))
      const detaljer = await pLimit(detaljTasks, 3)

      const rader = nye.map((h, idx) => {
        const d = detaljer[idx]
        return {
          organisasjon_id: org.id,
          tittel: d?.tittel ?? h.tittel,
          departement: d?.departement ?? h.departement,
          regjeringen_url: h.regjeringen_url,
          publisert_dato: d?.publisert_dato ?? h.publisert_dato,
          horingsfrist: d?.horingsfrist ?? h.horingsfrist,
          referanse: d?.referanse ?? null,
          horing_type: d?.horing_type ?? null,
          beskrivelse: d?.beskrivelse ?? null,
          horing_instanser: d?.horing_instanser ?? [],
          status: 'innkommet' as const,
          utvalg: [] as string[],
        }
      })

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
      antall_funnet_pa_siden: listeHoringer.length,
      antall_nye_totalt: totaltNye,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil'
    console.error('hent-offentlige-horinger feil:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
