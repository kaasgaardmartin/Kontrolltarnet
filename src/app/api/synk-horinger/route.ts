import { NextResponse } from 'next/server'

export async function POST() {
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
