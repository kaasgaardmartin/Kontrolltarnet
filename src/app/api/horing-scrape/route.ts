import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide, skrapGenerellSide } from '@/lib/horing-scrape'

export type { HoringScrapeResultat } from '@/lib/horing-scrape'

export async function POST(request: NextRequest) {
  // Autentisering
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 })

  let url: string
  try {
    const body = await request.json()
    url = body.url?.trim()
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Ugyldig URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  try {
    const resultat = url.includes('regjeringen.no')
      ? await skrapRegjeringenSide(url)
      : await skrapGenerellSide(url)
    return NextResponse.json(resultat)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil'
    return NextResponse.json({ error: `Kunne ikke hente data: ${msg}` }, { status: 500 })
  }
}
