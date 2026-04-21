// Delt hjelpemodul for skraping av høringssider fra regjeringen.no

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
export function parseNorskDato(str: string): string | null {
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

// Dekoder kun tegn-entiteter (æøå osv.) — beholder &lt; &gt; &amp; for å ikke ødelegge HTML-struktur
function dekodTegnEntiteter(str: string): string {
  return str
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&oslash;/gi, 'ø')
    .replace(/&aelig;/gi, 'æ')
    .replace(/&aring;/gi, 'å')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&Aring;/g, 'Å')
    .replace(/&szlig;/g, 'ß')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&uuml;/gi, 'ü')
}

// Dekoder alle HTML-entiteter inkl. strukturelle — brukes på tekstinnhold
function dekodHtmlEntiteter(str: string): string {
  return dekodTegnEntiteter(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export function renskTekst(str: string): string {
  return dekodHtmlEntiteter(str).replace(/\s+/g, ' ').trim()
}

// Henter og parser en regjeringen.no høring-side
export async function skrapRegjeringenSide(url: string): Promise<HoringScrapeResultat> {
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'nb-NO,nb;q=0.9', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fra regjeringen.no`)
  // Dekod tegn-entiteter (&#248; → ø osv.) på hele HTML-en slik at regex-søk etter æøå fungerer
  const html = dekodTegnEntiteter(await resp.text())

  // ---- Tittel ----
  const tittelMatch = html.match(/<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const tittel = tittelMatch
    ? renskTekst(tittelMatch[1].replace(/<[^>]+>/g, ''))
    : 'Ukjent tittel'

  // ---- Departement ----
  // Prøv article-source-klasse, deretter "Publisert av:", deretter "X sender med dette"
  const deptMatch =
    html.match(/class="[^"]*article-source[^"]*"[^>]*>([\s\S]*?)<\//)
    || html.match(/Publisert av:\s*<[^>]+>([\s\S]*?)<\//)
    || html.match(/([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]+(?:departementet|direktoratet|tilsynet|rådet|Statsministerens kontor))\s+sender\s+med\s+dette/u)
    || html.match(/<meta[^>]*(?:name="author"|property="og:site_name")[^>]*content="([^"]+)"/)
  const departement = deptMatch ? renskTekst(deptMatch[1].replace(/<[^>]+>/g, '')) : null

  // ---- Høringsfrist og publiseringsdato ----
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
    // Format 1: "Høringsfrist: DD.MM.YYYY"
    const f1 = html.match(/[Hh]øringsfrist[:\s]+(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4})/i)
    if (f1) horingsfrist = parseNorskDato(f1[1])
  }
  if (!horingsfrist) {
    // Format 2: "Frist for å sende inn høringssvar er DD. månedsnavn YYYY"
    const f2 = html.match(/[Ff]rist\s+for\s+å\s+sende\s+inn\s+høringssvar\s+er\s+(\d{1,2}\.?\s*(?:\d{1,2}\.\d{4}|(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4}))/i)
    if (f2) horingsfrist = parseNorskDato(f2[1])
  }
  if (!horingsfrist) {
    // Format 3: "Høringsfristen er DD. månedsnavn YYYY"
    const f3 = html.match(/[Hh]øringsfristen\s+er\s+(\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4})/i)
    if (f3) horingsfrist = parseNorskDato(f3[1])
  }
  if (!publisert_dato) {
    const pubMatch = html.match(/[Pp]ublisert[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i)
    if (pubMatch) publisert_dato = parseNorskDato(pubMatch[1])
    const metaDateMatch = html.match(/<meta[^>]*(?:name="date"|property="article:published_time")[^>]*content="([^"]+)"/)
    if (!publisert_dato && metaDateMatch) {
      publisert_dato = metaDateMatch[1].substring(0, 10)
    }
  }

  // ---- Saksnummer/referanse ----
  // Prøv "Vår ref.:" først (høringsbrev-format), deretter generisk
  const varRefMatch = html.match(/[Vv]år\s+ref\.?[:\s]+([^\s<\n]+(?:\s+[^\s<\n]+)?)/i)
  const refMatch = varRefMatch
    ?? html.match(/(?:Saksnr\.?|Referanse)[:\s]*(\d{2,4}\/\d+)/i)
  const referanse = refMatch ? renskTekst(refMatch[1].replace(/<[^>]+>/g, '')) : null

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

  // ---- Beskrivelse: hent hele høringsbrev-teksten ----
  // regjeringen.no legger brødteksten i <article> eller div.article-body.
  // Vi samler alle <p>-tagger og kutter ved høringsinstans-seksjonen.
  let beskrivelse: string | null = null

  // Prøv å finne article-body eller article-element
  const articleBodyMatch =
    html.match(/<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)(?:<\/article>|<section[^>]*class="[^"]*hearing-instances[^"]*"|<h2[^>]*>[^<]*[Hh]øringsinstans)/i)
    ?? html.match(/<article[^>]*>([\s\S]*?)(?:<section[^>]*class="[^"]*hearing-instances[^"]*"|<h2[^>]*>[^<]*[Hh]øringsinstans)/i)
    ?? html.match(/<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*)/i)

  if (articleBodyMatch) {
    const bodyHtml = articleBodyMatch[1]
    // Hent alle <p>-tagger
    const paraMatches = [...bodyHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    const avsnitt = paraMatches
      .map(m => renskTekst(m[1].replace(/<[^>]+>/g, '')))
      .filter(t => t.length > 20) // Hopp over tomme/ubetydelige avsnitt
    beskrivelse = avsnitt.join('\n\n') || null
  }

  // Fallback: meta description
  if (!beskrivelse) {
    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/)
    if (metaDesc) beskrivelse = renskTekst(metaDesc[1])
  }

  // Begrens til 5000 tegn (ca. 3–4 avsnitt)
  if (beskrivelse && beskrivelse.length > 5000) {
    beskrivelse = beskrivelse.substring(0, 5000).replace(/\s+\S*$/, '…')
  }

  // ---- Høringsinstanser ----
  const instanser: string[] = []
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
    beskrivelse,
    horing_instanser: instanser,
  }
}
