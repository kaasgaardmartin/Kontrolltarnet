// Kjør én gang: node --env-file=.env.local scripts/run-migration.mjs
// Legger inn komité-mandater for 2025-2026 via Supabase service role

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Mangler env-variabler. Kjør med:\n  node --env-file=.env.local scripts/run-migration.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Komité-data: [navn-søk, totalt, { parti: antall }]
const KOMITEER = [
  ['%Finanskomit%',              17, { Ap:5, FrP:4, H:2, SV:1, SP:1, R:1, MDG:1, KrF:1, V:1 }],
  ['%Arbeids%sosial%',           12, { Ap:4, FrP:4, H:2, SV:1, R:1,  SP:0, MDG:0, KrF:0, V:0 }],
  ['%Energi%milj%',              16, { Ap:5, FrP:4, H:2, SV:1, SP:1, R:1,  MDG:1, V:1,  KrF:0 }],
  ['%Familie%kultur%',           11, { Ap:3, FrP:3, H:2, KrF:1, SV:1, MDG:1, SP:0, R:0,  V:0 }],
  ['%Helse%omsorg%',             15, { Ap:5, FrP:4, H:2, SP:1,  R:1,  SV:1, KrF:1, MDG:0, V:0 }],
  ['%Justis%',                   13, { Ap:4, FrP:4, H:2, MDG:1, KrF:1, SP:1, SV:0, R:0,  V:0 }],
  ['%Kommunal%forvaltning%',     14, { Ap:4, FrP:4, H:2, R:1,  MDG:1, SP:1, SV:1, KrF:0, V:0 }],
  ['%Kontroll%konstitusjon%',    14, { Ap:4, FrP:4, H:1, SV:1, SP:1,  R:1,  MDG:1, KrF:1, V:0 }],
  ['%Nærings%',                  16, { Ap:5, FrP:4, H:2, MDG:1, SV:1, R:1,  SP:1,  KrF:1, V:0 }],
  ['%Transport%kommunikasjon%',  14, { Ap:4, FrP:5, H:2, MDG:1, SP:1, R:1,  SV:0,  KrF:0, V:0 }],
  ['%Utdanning%forskning%',      15, { Ap:4, FrP:4, H:2, SV:1,  SP:1, R:1,  KrF:1, V:1,  MDG:0 }],
  ['%Utenriks%forsvar%',         17, { Ap:5, FrP:3, H:3, SV:1,  SP:1, R:1,  MDG:1, KrF:1, V:1 }],
]

let ok = 0
let feil = 0

for (const [søk, totalt, mandater] of KOMITEER) {
  // Finn komiteer som matcher navn-søket (kan være flere org-er)
  const { data: komiteer, error: fetchErr } = await supabase
    .from('komiteer')
    .select('id, navn')
    .ilike('navn', søk)

  if (fetchErr) {
    console.error(`❌ Feil ved oppslag for "${søk}":`, fetchErr.message)
    feil++
    continue
  }

  if (!komiteer || komiteer.length === 0) {
    console.warn(`⚠️  Ingen komité funnet for søk: ${søk}`)
    continue
  }

  for (const komite of komiteer) {
    // Oppdater totalt_antall
    await supabase.from('komiteer').update({ totalt_antall: totalt }).eq('id', komite.id)

    // Upsert mandater
    const rader = Object.entries(mandater).map(([parti, antall]) => ({
      komite_id: komite.id,
      parti,
      antall,
    }))

    const { error: upsertErr } = await supabase
      .from('komite_mandater')
      .upsert(rader, { onConflict: 'komite_id,parti' })

    if (upsertErr) {
      console.error(`❌ Feil ved upsert for "${komite.navn}":`, upsertErr.message)
      feil++
    } else {
      console.log(`✅ ${komite.navn} (${totalt} medlemmer)`)
      ok++
    }
  }
}

console.log(`\nFerdig: ${ok} oppdatert, ${feil} feil`)
