import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { skrapRegjeringenSide } from '@/lib/horing-scrape'

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

  const { data: horinger, error } = await supabase
    .from('offentlige_horinger')
    .select('id, regjeringen_url, horingsfrist, departement, publisert_dato')
    .not('regjeringen_url', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!horinger?.length) return NextResponse.json({ melding: 'Ingen høringer', antall: 0 })

  let oppdatert = 0
  let feilet = 0

  const tasks = horinger.map(h => async () => {
    try {
      const d = await skrapRegjeringenSide(h.regjeringen_url!)
      // Behold eksisterende verdi hvis scraperen ikke finner noe (aldri overskrive med null)
      const { error: upErr } = await supabase
        .from('offentlige_horinger')
        .update({
          tittel: d.tittel,
          departement: d.departement ?? h.departement,
          horingsfrist: d.horingsfrist ?? h.horingsfrist,
          publisert_dato: d.publisert_dato ?? h.publisert_dato,
          referanse: d.referanse,
          horing_type: d.horing_type,
          beskrivelse: d.beskrivelse,
          horing_instanser: d.horing_instanser,
        })
        .eq('id', h.id)
      if (upErr) { feilet++; return }
      oppdatert++
    } catch {
      feilet++
    }
  })

  await pLimit(tasks, 3)
  return NextResponse.json({ melding: 'Reimport fullført', totalt: horinger.length, oppdatert, feilet })
}
