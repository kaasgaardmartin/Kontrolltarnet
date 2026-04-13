import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendFristPaminnelseEpost, sendHoringsfristEpost } from '@/lib/email'

// Denne ruten kalles daglig av Vercel Cron eller en ekstern tjeneste
// Sikret med CRON_SECRET i headers

export async function GET(request: NextRequest) {
  // Verifiser at det er en autorisert cron-jobb
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const idag = new Date()
  idag.setHours(0, 0, 0, 0)

  // Finn frister som er i dag, i morgen, eller om 3 dager
  const treDAgerFrem = new Date(idag)
  treDAgerFrem.setDate(treDAgerFrem.getDate() + 3)

  // ─── 1. Oppgave-fristpåminnelser ─────────────────────────────────

  const { data: aktiviteter } = await supabase
    .from('aktiviteter')
    .select(`
      id, beskrivelse, type, frist, ansvarlig_id,
      saker!inner(id, tittel)
    `)
    .eq('status', 'planlagt')
    .not('frist', 'is', null)
    .not('ansvarlig_id', 'is', null)
    .lte('frist', treDAgerFrem.toISOString().split('T')[0])
    .gte('frist', idag.toISOString().split('T')[0])

  // Grupper per ansvarlig
  const perBruker: Record<string, {
    oppgaver: { beskrivelse: string; type: string; frist: string; sakTittel: string; sakId: string }[]
  }> = {}

  for (const a of aktiviteter ?? []) {
    if (!a.ansvarlig_id || !a.frist) continue
    const sak = a.saker as unknown as { id: string; tittel: string }
    if (!perBruker[a.ansvarlig_id]) {
      perBruker[a.ansvarlig_id] = { oppgaver: [] }
    }
    perBruker[a.ansvarlig_id].oppgaver.push({
      beskrivelse: a.beskrivelse,
      type: a.type,
      frist: a.frist,
      sakTittel: sak.tittel,
      sakId: sak.id,
    })
  }

  // Hent brukerinfo og send e-post
  let sendt = 0
  let feilet = 0

  for (const [brukerId, data] of Object.entries(perBruker)) {
    const { data: bruker } = await supabase
      .from('brukere')
      .select('navn, epost')
      .eq('id', brukerId)
      .single()

    if (!bruker?.epost) continue

    const result = await sendFristPaminnelseEpost({
      tilEpost: bruker.epost,
      tilNavn: bruker.navn,
      oppgaver: data.oppgaver,
    })

    if (result.success) sendt++
    else feilet++
  }

  // ─── 2. Høringsfrist-påminnelser ─────────────────────────────────

  const { data: sakerMedHoring } = await supabase
    .from('saker')
    .select('id, tittel, horingsfrist, organisasjon_id')
    .eq('arkivert', false)
    .not('horingsfrist', 'is', null)
    .lte('horingsfrist', treDAgerFrem.toISOString().split('T')[0])
    .gte('horingsfrist', idag.toISOString().split('T')[0])

  for (const sak of sakerMedHoring ?? []) {
    if (!sak.horingsfrist) continue

    const fristDato = new Date(sak.horingsfrist)
    fristDato.setHours(0, 0, 0, 0)
    const dagerIgjen = Math.ceil((fristDato.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))

    // Finn alle som følger saken
    const { data: abonnenter } = await supabase
      .from('varsel_innstillinger')
      .select('bruker_id, brukere!inner(navn, epost)')
      .eq('sak_id', sak.id)
      .eq('aktiv', true)

    for (const ab of abonnenter ?? []) {
      const bruker = ab.brukere as unknown as { navn: string; epost: string }
      if (!bruker?.epost) continue

      const result = await sendHoringsfristEpost({
        tilEpost: bruker.epost,
        tilNavn: bruker.navn,
        sakTittel: sak.tittel,
        sakId: sak.id,
        horingsfrist: sak.horingsfrist,
        dagerIgjen,
      })

      if (result.success) sendt++
      else feilet++
    }
  }

  return NextResponse.json({
    ok: true,
    sendt,
    feilet,
    tidspunkt: new Date().toISOString(),
  })
}
