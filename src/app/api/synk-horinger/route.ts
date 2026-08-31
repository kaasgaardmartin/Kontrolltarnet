import { NextResponse } from 'next/server'
import { hentBrukerOgOrg } from '@/lib/actions'

export async function POST() {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) {
    return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 })
  }
  if (bruker.rolle !== 'org-admin') {
    return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Mangler konfigurasjon' }, { status: 500 })
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
    return NextResponse.json({ error: body }, { status: resp.status })
  }

  return NextResponse.json(await resp.json())
}
