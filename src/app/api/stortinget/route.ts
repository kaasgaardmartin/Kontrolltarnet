import { NextRequest, NextResponse } from 'next/server'

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

function parseSak(sakXml: string): StortingetSak {
  const id = extractText(sakXml, 'id') ?? ''
  const tittel = extractText(sakXml, 'tittel') ?? ''
  const korttittel = extractText(sakXml, 'korttittel') ?? ''
  const type = extractText(sakXml, 'type') ?? ''
  const status = extractText(sakXml, 'status') ?? ''
  const dokumentgruppe = extractText(sakXml, 'dokumentgruppe') ?? ''
  const henvisning = extractText(sakXml, 'henvisning')
  const sist_oppdatert = extractText(sakXml, 'sist_oppdatert_dato')

  // Komité
  const komiteBlock = sakXml.match(/<komite>([\s\S]*?)<\/komite>/)
  let komite: string | null = null
  let komite_id: string | null = null
  if (komiteBlock) {
    komite = extractText(komiteBlock[1], 'navn')
    komite_id = extractText(komiteBlock[1], 'id')
  }

  // Emner
  const emneBlock = sakXml.match(/<emne_liste>([\s\S]*?)<\/emne_liste>/)
  const emner: string[] = []
  if (emneBlock) {
    const navnMatches = extractAll(emneBlock[1], 'navn')
    emner.push(...navnMatches)
  }

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
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sesjonId = searchParams.get('sesjon') || '2024-2025'
  const sok = searchParams.get('sok')?.toLowerCase()

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
