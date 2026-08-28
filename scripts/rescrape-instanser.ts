import { createClient } from '@supabase/supabase-js'
import { skrapRegjeringenSide } from '../src/lib/horing-scrape'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  const { data: horinger, error } = await supabase
    .from('offentlige_horinger')
    .select('id, tittel, regjeringen_url')
    .not('regjeringen_url', 'is', null)
    .neq('status', 'arkivert')

  if (error) {
    console.error('DB-feil:', error.message)
    process.exit(1)
  }

  if (!horinger?.length) {
    console.log('Ingen høringer å oppdatere')
    return
  }

  console.log(`Fant ${horinger.length} høringer med regjeringen_url`)

  let oppdatert = 0
  let uendret = 0
  let feil = 0

  for (let i = 0; i < horinger.length; i++) {
    const h = horinger[i]
    if (!h.regjeringen_url) continue

    // Vent mellom forespørsler for å unngå rate-limiting
    if (i > 0) await new Promise(r => setTimeout(r, 1000))

    try {
      const scraped = await skrapRegjeringenSide(h.regjeringen_url)
      if (scraped.horing_instanser.length === 0) {
        uendret++
        continue
      }

      const { error: updateError } = await supabase
        .from('offentlige_horinger')
        .update({ horing_instanser: scraped.horing_instanser })
        .eq('id', h.id)

      if (updateError) {
        console.error(`  ✗ ${h.tittel}: ${updateError.message}`)
        feil++
      } else {
        console.log(`  ✓ ${h.tittel} — ${scraped.horing_instanser.length} instanser`)
        oppdatert++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil'
      console.error(`  ✗ ${h.tittel}: ${msg}`)
      feil++
    }
  }

  console.log(`\nFerdig: ${oppdatert} oppdatert, ${uendret} uten instanser, ${feil} feil`)

  if (feil > horinger.length / 2) {
    console.error('Mer enn halvparten feilet — mulig IP-blokkering')
    process.exit(1)
  }
}

main()
