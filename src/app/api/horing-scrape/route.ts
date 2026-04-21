import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export interface HoringScrapeResultat {
  tittel: string
  departement: string | null
  horingsfrist: string | null    // ISO date YYYY-MM-DD
  publisert_dato: string | null
  referanse: string | null
  horing_type: 'skriftlig' | 'muntlig' | 'begge' | null
  beskrivelse: string | null
  horing_instanser: string[]
}

// Prøver å parse en norsk dato-streng til YYYY-MM-DD
function parseNorskDato(str: string): string | null {
  if (!str) return null
  // Format: "20.07.2026" eller "20. juli 2026"
  const kortMatch = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (kortMatch) {
    const [, d, m, y] = kortMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const MÅNEDER: Record<string, string> = {
    januar: '01', februar: '02', mars: '03', april: '04',
    mai: '05', juni: '06', juli: '07', august: '08',
    september: '09', oktober: '10', november: '11', desember: '12',
  }
  const langMatch = str.toLowerCase().match(/(\d{1,2})\.\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*(\d{4})/)
  if (langMatch) {
    const [, d, m, y] = langMatch
    return `${y}-${MÅNEDER[m]}-${d.padStart(2, '0')}`
  }
  return null
}

function renskTekst(str: string): string {
  return str.replace(/\s+/g, ' ').trim()
}

// Henter og parser en regjeringen.no høring-side
async function skrapRegjeringenSide(url: string): Promise<HoringScrapeResultat> {
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'nb-NO,nb;q=0.9', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fra regjeringen.no`)
  const html = await resp.text()

  // ---- Tittel ----
  const tittelMatch = html.match(/<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const tittel = tittelMatch
    ? renskTekst(tittelMatch[1].replace(/<[^>]+>/g, ''))
    : 'Ukjent tittel'

  // ---- Departement ----
  const deptMatch = html.match(/class="[^"]*article-source[^"]*"[^>]*>([\s\S]*?)<\//)
    || html.match(/Publisert av:\s*<[^>]+>([\s\S]*?)<\//)
  const departement = deptMatch ? renskTekst(deptMatch[1].replace(/<[^>]+>/g, '')) : null

  // ---- Høringsfrist og publiseringsdato ----
  // Søk etter "Høringsfrist" og "Publisert" dato-labels i metadata-seksjoner
  let horingsfrist: string | null = null
  let publisert_dato: string | null = null

  // regjeringen.no bruker dl/dt/dd-struktur for metadata
  const metaBlock = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/g) || []
  for (const block of metaBlock) {
    const pairs = [...block.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)]
    for (const [, label, value] of pairs) {
      const l = renskTekst(label.replace(/<[^>]+>/g, '')).toLowerCase()
      const v = renskTekst(value.replace(/<[^>]+>/g, ''))
      if (l.includes('høringsfrist') || l.includes('frist')) {
        horingsfrist = parseNorskDato(v)
      } else if (l.includes('publisert')) {
        publisert_dato = parseNorskDato(v)
      }
    }
  }

  // Fallback: søk i rå tekst
  if (!horingsfrist) {
    const fristMatch = html.match(/[Hh]øringsfrist[:\s]*(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4})/i)
    if (fristMatch) horingsfrist = parseNorskDato(fristMatch[1])
  }
  if (!publisert_dato) {
    const pubMatch = html.match(/[Pp]ublisert[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i)
    if (pubMatch) publisert_dato = parseNorskDato(pubMatch[1])
    // Also try ISO date in meta tags
    const metaDateMatch = html.match(/<meta[^>]*(?:name="date"|property="article:published_time")[^>]*content="([^"]+)"/)
    if (!publisert_dato && metaDateMatch) {
      publisert_dato = metaDateMatch[1].substring(0, 10)
    }
  }

  // ---- Saksnummer/referanse ----
  const refMatch = html.match(/(?:Saksnr\.?|Referanse|Id)[:\s]*(\d{2}\/\d+)/i)
  const referanse = refMatch ? refMatch[1] : null

  // ---- Høring type (skriftlig/muntlig) ----
  let horing_type: 'skriftlig' | 'muntlig' | 'begge' | null = null
  const htmlLower = html.toLowerCase()
  if (htmlLower.includes('skriftlig') && htmlLower.includes('muntlig')) {
    horing_type = 'begge'
  } else if (htmlLower.includes('skriftlig høring') || htmlLower.includes('skriftlige innspill')) {
    horing_type = 'skriftlig'
  } else if (htmlLower.includes('muntlig høring') || htmlLower.includes('åpent møte')) {
    horing_type = 'muntlig'
  }

  // ---- Beskrivelse ----
  // Hent intro-avsnitt fra article body
  const bodyMatch = html.match(/<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/)
  let beskrivelse: string | null = null
  if (bodyMatch) {
    const firstPara = bodyMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/)
    if (firstPara) {
      beskrivelse = renskTekst(firstPara[1].replace(/<[^>]+>/g, ''))
    }
  }
  if (!beskrivelse) {
    // Fallback: meta description
    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/)
    if (metaDesc) beskrivelse = renskTekst(metaDesc[1])
  }

  // ---- Høringsinstanser ----
  const instanser: string[] = []
  // Se etter en seksjon med høringsinstanser (vanligvis en liste)
  const instansBlock = html.match(/[Hh]øringsinstans[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/)
  if (instansBlock) {
    const liMatches = [...instansBlock[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    for (const [, li] of liMatches) {
      const navn = renskTekst(li.replace(/<[^>]+>/g, ''))
      if (navn) instanser.push(navn)
    }
  }

  return {
    tittel,
    departement,
    horingsfrist,
    publisert_dato,
    referanse,
    horing_type,
    beskrivelse: beskrivelse ? beskrivelse.substring(0, 1000) : null,
    horing_instanser: instanser,
  }
}

export async function POST(request: NextRequest) {
  // Autentisering
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 })

  let url: string
  try {
    const body = await request.json()
    url = body.url
    if (!url || !url.includes('regjeringen.no')) {
      return NextResponse.json({ error: 'Ugyldig URL — må være fra regjeringen.no' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  try {
    const resultat = await skrapRegjeringenSide(url)
    return NextResponse.json(resultat)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil'
    return NextResponse.json({ error: `Kunne ikke hente data: ${msg}` }, { status: 500 })
  }
}
