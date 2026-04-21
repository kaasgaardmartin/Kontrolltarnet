import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide } from '@/lib/horing-scrape'

export type { HoringScrapeResultat } from '@/lib/horing-scrape'

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
