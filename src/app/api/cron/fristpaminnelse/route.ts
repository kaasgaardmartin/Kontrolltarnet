import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// Samlet cron-jobb for påminnelser (kjøres daglig kl. 07:00)
//
// - Fristpåminnelser: (placeholder for fremtidig logikk)
// - Mandagsliste: sendes hver mandag
// ============================================================

// deno-lint-ignore no-explicit-any
async function sendMandagsliste(supabase: ReturnType<typeof createClient<any>>) {
  const { data: horinger, error: hErr } = await supabase
    .from('offentlige_horinger')
    .select('id, tittel, departement, utvalg, horingsfrist, intern_frist, regjeringen_url, status, organisasjon_id')
    .in('status', ['innkommet', 'til_vurdering', 'svarer'])
    .order('intern_frist', { ascending: true, nullsFirst: false })
    .returns<{ id: string; tittel: string; departement: string | null; utvalg: string[] | null; horingsfrist: string | null; intern_frist: string | null; regjeringen_url: string | null; status: string; organisasjon_id: string }[]>()

  if (hErr) {
    console.error('mandagsliste: feil ved henting av høringer', hErr)
    return { sendt: 0, feilet: 0, error: hErr.message }
  }

  const { data: brukere, error: bErr } = await supabase
    .from('brukere')
    .select('id, navn, epost, organisasjon_id')
    .eq('epost_mandagsliste', true)
    .eq('aktiv', true)
    .returns<{ id: string; navn: string; epost: string | null; organisasjon_id: string }[]>()

  if (bErr) {
    console.error('mandagsliste: feil ved henting av brukere', bErr)
    return { sendt: 0, feilet: 0, error: bErr.message }
  }

  const { sendMandagslisteEpost } = await import('@/lib/email')

  const datoDag = new Date().toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  let sendt = 0
  let feilet = 0

  for (const bruker of brukere ?? []) {
    if (!bruker.epost) continue

    const orgHoringer = (horinger ?? []).filter(h => h.organisasjon_id === bruker.organisasjon_id)
    if (orgHoringer.length === 0) continue

    const res = await sendMandagslisteEpost({
      tilEpost: bruker.epost,
      tilNavn: bruker.navn,
      dato: datoDag,
      horinger: orgHoringer.map(h => ({
        tittel: h.tittel,
        departement: h.departement,
        utvalg: h.utvalg ?? [],
        horingsfrist: h.horingsfrist,
        internFrist: h.intern_frist,
        regjeringenUrl: h.regjeringen_url,
        status: h.status,
      })),
    })

    if (res.success) sendt++
    else { feilet++; console.error('mandagsliste: feil for', bruker.epost, res.error) }
  }

  console.log(`mandagsliste: sendt=${sendt} feilet=${feilet}`)
  return { sendt, feilet }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultat: Record<string, unknown> = {
    ok: true,
    tidspunkt: new Date().toISOString(),
  }

  // Mandagsliste: kun på mandager (day 1)
  const erMandag = new Date().getUTCDay() === 1
  if (erMandag) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const ml = await sendMandagsliste(supabase)
    resultat.mandagsliste = ml
  }

  return NextResponse.json(resultat)
}
