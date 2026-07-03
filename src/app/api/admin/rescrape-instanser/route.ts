import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

// ============================================================
// Admin-endepunkt: Re-scrape høringsinstanser via Supabase
// Edge Function (Deno Deploy) som ikke blokkeres av
// regjeringen.no sin WAF, i motsetning til Vercel-IP-er.
// Sikret med CRON_SECRET
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET mangler' }, { status: 500 })
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Mangler SUPABASE_URL eller SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const resp = await fetch(
    `${supabaseUrl}/functions/v1/rescrape-instanser`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(280_000),
    }
  )

  if (!resp.ok) {
    const body = await resp.text()
    return NextResponse.json({ error: `Edge function feilet: HTTP ${resp.status} — ${body}` }, { status: 502 })
  }

  const result = await resp.json()
  return NextResponse.json(result)
}
