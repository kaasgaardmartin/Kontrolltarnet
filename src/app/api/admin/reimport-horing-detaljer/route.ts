import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide } from '@/lib/horing-scrape'

// Engangs-endepunkt: henter detaljsider for alle høringer som mangler beskrivelse
// Beskyttes med CRON_SECRET

async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Hent alle høringer med URL men uten beskrivelse
  const { data: horinger, error } = await supabase
    .from('offentlige_horinger')
    .select('id, regjeringen_url')
    .not('regjeringen_url', 'is', null)
    .is('beskrivelse', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!horinger?.length) return NextResponse.json({ melding: 'Ingen høringer trenger oppdatering', antall: 0 })

  let oppdatert = 0
  let feilet = 0

  const tasks = horinger.map(h => async () => {
    try {
      const d = await skrapRegjeringenSide(h.regjeringen_url!)
      const { error: upErr } = await supabase
        .from('offentlige_horinger')
        .update({
          tittel: d.tittel,
          departement: d.departement,
          horingsfrist: d.horingsfrist,
          publisert_dato: d.publisert_dato,
          referanse: d.referanse,
          horing_type: d.horing_type,
          beskrivelse: d.beskrivelse,
          horing_instanser: d.horing_instanser,
        })
        .eq('id', h.id)
      if (upErr) {
        console.error(`Update feilet for ${h.id}:`, upErr.message)
        feilet++
      } else {
        oppdatert++
      }
    } catch (err) {
      console.error(`Skrap feilet for ${h.regjeringen_url}:`, err)
      feilet++
    }
  })

  await pLimit(tasks, 3)

  return NextResponse.json({
    melding: 'Reimport fullført',
    totalt: horinger.length,
    oppdatert,
    feilet,
  })
}
