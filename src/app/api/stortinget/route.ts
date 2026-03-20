import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ============================================================
// Stortinget API Proxy — henter saker fra data.stortinget.no
// Konverterer XML → JSON og returnerer kun relevante felter
// ============================================================

export interface StortingetSak {
  id: string
  tittel: string
  korttittel: string
  type: string
  status: string
  dokumentgruppe: string
  komite: string | null
  komite_id: string | null
  henvisning: string | null
  sist_oppdatert: string | null
  emner: string[]
  innstilling_dato: string | null  // Dato for komitéinnstilling (AVGITT)
  behandling_dato: string | null   // Dato for behandling i salen (BEHS)
}

function extractText(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function extractAll(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g')
  const matches: string[] = []
  let m
  while ((m = regex.exec(xml)) !== null) {
    matches.push(m[1].trim())
  }
  return matches
}

// Parser norsk dato "dd.MM.yyyy HH:mm:ss" til ISO "yyyy-MM-dd"
function parseNorskDato(dato: string | null): string | null {
  if (!dato) return null
  const match = dato.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

// Henter dato for en spesifikk saksgang-hendelse (f.eks. AVGFRIST, AVGITT, BEHS)
function extractHendelseDato(sakXml: string, hendelseId: string): string | null {
  const hendelseRegex = /<saksgang_hendelse>([\s\S]*?)<\/saksgang_hendelse>/g
  let m
  while ((m = hendelseRegex.exec(sakXml)) !== null) {
    const block = m[1]
    const id = extractText(block, 'id')
    if (id === hendelseId) {
      const dato = extractText(block, 'dato')
      // Ignorer placeholder-datoer (01.01.0001)
      if (dato?.startsWith('01.01.0001')) return null
      return parseNorskDato(dato)
    }
  }
  return null
}

function parseSak(sakXml: string): StortingetSak {
  // Fjern nestede blokker for å finne top-level felter riktig
  // (unngår å matche <id> inne i emne_liste, komite, forslagstiller_liste osv.)
  const topLevel = sakXml
    .replace(/<emne_liste>[\s\S]*?<\/emne_liste>/g, '')
    .replace(/<forslagstiller_liste>[\s\S]*?<\/forslagstiller_liste>/g, '')
    .replace(/<saksordfoerer_liste>[\s\S]*?<\/saksordfoerer_liste>/g, '')
    .replace(/<komite>[\s\S]*?<\/komite>/g, '')
    .replace(/<saksgang>[\s\S]*?<\/saksgang>/g, '')
    .replace(/<publikasjon_referanse_liste>[\s\S]*?<\/publikasjon_referanse_liste>/g, '')

  const id = extractText(topLevel, 'id') ?? ''
  const tittel = extractText(topLevel, 'tittel') ?? ''
  const korttittel = extractText(topLevel, 'korttittel') ?? ''
  const type = extractText(topLevel, 'type') ?? ''
  const status = extractText(topLevel, 'status') ?? ''
  const dokumentgruppe = extractText(topLevel, 'dokumentgruppe') ?? ''
  const henvisning = extractText(topLevel, 'henvisning')
  const sist_oppdatert = extractText(topLevel, 'sist_oppdatert_dato')

  // Komité (fra den nestede blokken)
  const komiteBlock = sakXml.match(/<komite>([\s\S]*?)<\/komite>/)
  let komite: string | null = null
  let komite_id: string | null = null
  if (komiteBlock) {
    komite = extractText(komiteBlock[1], 'navn')
    komite_id = extractText(komiteBlock[1], 'id')
  }

  // Emner (fra den nestede blokken)
  const emneBlock = sakXml.match(/<emne_liste>([\s\S]*?)<\/emne_liste>/)
  const emner: string[] = []
  if (emneBlock) {
    const navnMatches = extractAll(emneBlock[1], 'navn')
    emner.push(...navnMatches)
  }

  // Datoer fra saksgang-hendelser
  // Komitédato: AVGFRIST (frist for avgivelse) → fallback til AVGITT (faktisk avgitt)
  const innstilling_dato = extractHendelseDato(sakXml, 'AVGFRIST')
    ?? extractHendelseDato(sakXml, 'AVGITT')
  // Stortingsdato: PLBEHS (planlagt behandling) → BEHS (faktisk behandlet) → VOT (votering)
  const behandling_dato = extractHendelseDato(sakXml, 'PLBEHS')
    ?? extractHendelseDato(sakXml, 'BEHS')
    ?? extractHendelseDato(sakXml, 'VOT')

  return {
    id,
    tittel,
    korttittel,
    type,
    status,
    dokumentgruppe,
    komite,
    komite_id,
    henvisning,
    sist_oppdatert,
    emner,
    innstilling_dato,
    behandling_dato,
  }
}

// Hent detaljer for én enkelt sak (inkl. saksgang med datoer)
async function hentSakDetaljer(sakId: string): Promise<StortingetSak | null> {
  const url = `https://data.stortinget.no/eksport/sak?sakid=${encodeURIComponent(sakId)}`
  const response = await fetch(url)
  if (!response.ok) return null
  const xml = await response.text()
  return parseSak(xml)
}

export async function GET(request: NextRequest) {
  // Autentiseringskontroll — kun innloggede brukere
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Ikke autentisert. Logg inn for å bruke dette endepunktet.' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const sakId = searchParams.get('sakid')
  const sesjonId = searchParams.get('sesjon') || '2024-2025'
  const sok = searchParams.get('sok')?.toLowerCase()

  // Hent én enkelt sak med fulle detaljer (inkl. datoer)
  if (sakId) {
    try {
      const sak = await hentSakDetaljer(sakId)
      if (!sak) {
        return NextResponse.json(
          { error: `Fant ikke sak ${sakId}` },
          { status: 404 }
        )
      }
      return NextResponse.json({ sak })
    } catch (error) {
      console.error('Feil ved henting av sak:', error)
      return NextResponse.json(
        { error: 'Kunne ikke hente sak fra Stortinget' },
        { status: 500 }
      )
    }
  }

  // Søk i saker for en sesjon
  try {
    const url = `https://data.stortinget.no/eksport/saker?sesjonid=${encodeURIComponent(sesjonId)}`
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache i 1 time
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Stortinget API returnerte ${response.status}` },
        { status: response.status }
      )
    }

    const xml = await response.text()

    // Split på <sak> elementer
    const sakBlocks = xml.split(/<sak>/).slice(1) // Skip first (before first <sak>)
    let saker: StortingetSak[] = sakBlocks.map(block => parseSak(block))

    // Filtrer på søk hvis angitt
    if (sok) {
      saker = saker.filter(s =>
        s.tittel.toLowerCase().includes(sok) ||
        s.korttittel.toLowerCase().includes(sok) ||
        s.id.includes(sok) ||
        s.emner.some(e => e.toLowerCase().includes(sok))
      )
    }

    // Sorter etter sist oppdatert (nyeste først)
    saker.sort((a, b) => {
      if (!a.sist_oppdatert) return 1
      if (!b.sist_oppdatert) return -1
      return b.sist_oppdatert.localeCompare(a.sist_oppdatert)
    })

    return NextResponse.json({
      sesjon: sesjonId,
      antall: saker.length,
      saker: saker.slice(0, 100), // Maks 100 resultater
    })
  } catch (error) {
    console.error('Feil ved henting fra Stortinget:', error)
    return NextResponse.json(
      { error: 'Kunne ikke hente data fra Stortinget' },
      { status: 500 }
    )
  }
}
