'use server'

import { createServerSupabaseClient } from './supabase-server'
import type {
  Tema, Maal, MaalMedDetaljer, Nokkelresultat, NokkelresultatMedTiltak,
  TiltakAktivitet, Gjennomslag, MaalKobling, KRVurdering, Statusoppdatering,
  KRType, GjennomslagVerdi, GjennomslagVurdering, KildeType, MaalUtfall,
} from './pavirkning-types'
import type { Lenke, LenkeType } from './types'

// ============================================================
// Helpers
// ============================================================

async function hentBrukerOgOrg() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bruker } = await supabase
    .from('brukere')
    .select('id, organisasjon_id, rolle, navn, epost')
    .eq('id', user.id)
    .single()

  return bruker as { id: string; organisasjon_id: string; rolle: string; navn: string; epost: string } | null
}

const MAX_TITTEL = 300
const MAX_TEKST = 5000
const MAX_URL = 2048

function validerTekst(tekst: string, maxLength: number, feltnavn: string): string | null {
  if (!tekst || tekst.trim().length === 0) return `${feltnavn} kan ikke være tom`
  if (tekst.length > maxLength) return `${feltnavn} kan ikke være lengre enn ${maxLength} tegn`
  return null
}

type Result = { success: boolean; error?: string; id?: string }

// ============================================================
// Temaer
// ============================================================

export async function hentTemaer(): Promise<Tema[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('tema')
    .select('*')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('rekkefolge')

  return (data ?? []) as Tema[]
}

// ============================================================
// Mål – oversikt
// ============================================================

export async function hentMaalOversikt(arkivert = false): Promise<MaalMedDetaljer[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data: maalData } = await supabase
    .from('maal')
    .select(`
      *,
      tema(*),
      nokkelresultater(
        *,
        aktiviteter:aktiviteter!nokkelresultat_id(*)
      ),
      gjennomslag(*),
      lenker!maal_id(*),
      maal_koblinger(
        *,
        saker:sak_id(id, tittel, landing, komite_dato, stortings_dato, horingsfrist),
        offentlige_horinger:offentlig_horing_id(id, tittel, horingsfrist)
      ),
      statusoppdateringer!maal_id(*)
    `)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('arkivert', arkivert)
    .order('created_at', { ascending: true })

  if (!maalData) return []

  return maalData.map((m: Record<string, unknown>) => {
    const nokkelresultater = ((m.nokkelresultater ?? []) as Record<string, unknown>[]).map(kr => ({
      ...kr,
      tiltak: ((kr.aktiviteter ?? []) as TiltakAktivitet[]).sort((a, b) => {
        if (a.status === 'planlagt' && b.status !== 'planlagt') return -1
        if (a.status !== 'planlagt' && b.status === 'planlagt') return 1
        return (a.frist ?? '').localeCompare(b.frist ?? '')
      }),
    })) as NokkelresultatMedTiltak[]
    nokkelresultater.sort((a, b) => a.rekkefolge - b.rekkefolge)

    const statusoppdateringer = (m.statusoppdateringer ?? []) as Statusoppdatering[]
    const ventende = statusoppdateringer.find(s => s.status === 'venter') ?? null

    return {
      ...m,
      nokkelresultater,
      gjennomslag: (m.gjennomslag ?? []) as Gjennomslag[],
      lenker: (m.lenker ?? []) as Lenke[],
      koblinger: (m.maal_koblinger ?? []) as MaalMedDetaljer['koblinger'],
      ventende_oppdatering: ventende,
    } as unknown as MaalMedDetaljer
  })
}

// ============================================================
// Mål – detaljer
// ============================================================

export async function hentMaal(maalId: string): Promise<MaalMedDetaljer | null> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return null

  const { data: m } = await supabase
    .from('maal')
    .select(`
      *,
      tema(*),
      nokkelresultater(
        *,
        aktiviteter:aktiviteter!nokkelresultat_id(*, brukere:ansvarlig_id(navn)),
        kr_vurderinger:kr_vurderinger!nokkelresultat_id(*)
      ),
      gjennomslag(*),
      lenker!maal_id(*),
      maal_koblinger(
        *,
        saker:sak_id(id, tittel, landing, komite_dato, stortings_dato, horingsfrist),
        offentlige_horinger:offentlig_horing_id(id, tittel, horingsfrist)
      ),
      statusoppdateringer!maal_id(*)
    `)
    .eq('id', maalId)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .single()

  if (!m) return null

  const mData = m as Record<string, unknown>

  const nokkelresultater = ((mData.nokkelresultater ?? []) as Record<string, unknown>[]).map(kr => ({
    ...kr,
    tiltak: ((kr.aktiviteter ?? []) as TiltakAktivitet[]).sort((a, b) => {
      if (a.status === 'planlagt' && b.status !== 'planlagt') return -1
      if (a.status !== 'planlagt' && b.status === 'planlagt') return 1
      return (a.frist ?? '').localeCompare(b.frist ?? '')
    }),
    vurderinger: ((kr.kr_vurderinger ?? []) as KRVurdering[]).sort((a, b) =>
      a.dato.localeCompare(b.dato)
    ),
  })) as NokkelresultatMedTiltak[]
  nokkelresultater.sort((a, b) => a.rekkefolge - b.rekkefolge)

  const statusoppdateringer = (mData.statusoppdateringer ?? []) as Statusoppdatering[]
  const ventende = statusoppdateringer.find(s => s.status === 'venter') ?? null

  return {
    ...mData,
    nokkelresultater,
    gjennomslag: ((mData.gjennomslag ?? []) as Gjennomslag[]).sort((a, b) =>
      b.dato.localeCompare(a.dato)
    ),
    lenker: (mData.lenker ?? []) as Lenke[],
    koblinger: (mData.maal_koblinger ?? []) as MaalMedDetaljer['koblinger'],
    ventende_oppdatering: ventende,
  } as unknown as MaalMedDetaljer
}

// ============================================================
// Mål – CRUD
// ============================================================

export async function opprettMaal(data: {
  tittel: string
  tema_id: string
  formulering?: string
  status_tekst?: string
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const feil = validerTekst(data.tittel, MAX_TITTEL, 'Tittel')
  if (feil) return { success: false, error: feil }

  const { data: maal, error } = await supabase
    .from('maal')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      tema_id: data.tema_id,
      tittel: data.tittel.trim(),
      formulering: data.formulering?.trim() || null,
      status_tekst: data.status_tekst?.trim() || null,
      created_by: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: maal.id }
}

export async function oppdaterMaal(maalId: string, data: {
  tittel?: string
  formulering?: string | null
  status_tekst?: string | null
  tema_id?: string
  siste_kommentar?: string | null
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  if (data.tittel) {
    const feil = validerTekst(data.tittel, MAX_TITTEL, 'Tittel')
    if (feil) return { success: false, error: feil }
  }

  const { error } = await supabase
    .from('maal')
    .update(data)
    .eq('id', maalId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function arkiverMaal(maalId: string, utfall: MaalUtfall, oppsummering: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const feil = validerTekst(oppsummering, MAX_TEKST, 'Oppsummering')
  if (feil) return { success: false, error: feil }

  const { error } = await supabase
    .from('maal')
    .update({
      arkivert: true,
      arkivert_dato: new Date().toISOString(),
      utfall,
      oppsummering: oppsummering.trim(),
    })
    .eq('id', maalId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function gjenapneMaal(maalId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('maal')
    .update({ arkivert: false, arkivert_dato: null, utfall: null, oppsummering: null })
    .eq('id', maalId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Nøkkelresultater
// ============================================================

export async function opprettNokkelresultat(data: {
  maal_id: string
  tekst: string
  type: KRType
  frist_tekst?: string
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const feil = validerTekst(data.tekst, MAX_TEKST, 'Tekst')
  if (feil) return { success: false, error: feil }

  // Finn neste rekkefølge
  const { count } = await supabase
    .from('nokkelresultater')
    .select('*', { count: 'exact', head: true })
    .eq('maal_id', data.maal_id)

  const { data: kr, error } = await supabase
    .from('nokkelresultater')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      maal_id: data.maal_id,
      tekst: data.tekst.trim(),
      type: data.type,
      frist_tekst: data.frist_tekst?.trim() || null,
      rekkefolge: (count ?? 0),
      created_by: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: kr.id }
}

export async function oppdaterNokkelresultat(krId: string, data: {
  tekst?: string
  type?: KRType
  frist_tekst?: string | null
  tall_naa?: number | null
  tall_maal?: number | null
  gjennomslag?: GjennomslagVerdi | null
  oppnadd?: boolean
  sannsynlighet?: number
  sist_endret_tekst?: string | null
  verdi?: string | null
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('nokkelresultater')
    .update(data)
    .eq('id', krId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettNokkelresultat(krId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('nokkelresultater')
    .delete()
    .eq('id', krId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Bytte type nullstiller verdien
export async function byttKRType(krId: string, nyType: KRType): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const resetData: Record<string, unknown> = {
    type: nyType,
    oppnadd: false,
    verdi: null,
    tall_naa: null,
    tall_maal: null,
    gjennomslag: nyType === 'gjennomslag' ? 'ukjent' : null,
  }

  const { error } = await supabase
    .from('nokkelresultater')
    .update(resetData)
    .eq('id', krId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Tiltak (aktiviteter med nokkelresultat_id)
// ============================================================

export async function opprettTiltak(data: {
  nokkelresultat_id: string
  beskrivelse: string
  ansvarlig_id?: string | null
  frist: string
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const feil = validerTekst(data.beskrivelse, MAX_TEKST, 'Beskrivelse')
  if (feil) return { success: false, error: feil }

  const { data: tiltak, error } = await supabase
    .from('aktiviteter')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      nokkelresultat_id: data.nokkelresultat_id,
      beskrivelse: data.beskrivelse.trim(),
      ansvarlig_id: data.ansvarlig_id || null,
      frist: data.frist,
      status: 'planlagt',
      type: 'annet',
      created_by: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: tiltak.id }
}

export async function oppdaterTiltak(tiltakId: string, data: {
  beskrivelse?: string
  ansvarlig_id?: string | null
  frist?: string
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('aktiviteter')
    .update({ ...data, updated_by: bruker.id })
    .eq('id', tiltakId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function markerTiltakGjort(tiltakId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('aktiviteter')
    .update({ status: 'utført', lukket_dato: new Date().toISOString().slice(0, 10), updated_by: bruker.id })
    .eq('id', tiltakId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function droppTiltak(tiltakId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('aktiviteter')
    .update({ status: 'avlyst', lukket_dato: new Date().toISOString().slice(0, 10), updated_by: bruker.id })
    .eq('id', tiltakId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function utsettTiltak(tiltakId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: tiltak } = await supabase
    .from('aktiviteter')
    .select('frist')
    .eq('id', tiltakId)
    .single()

  if (!tiltak) return { success: false, error: 'Tiltak ikke funnet' }

  // Utsett: maks(gammel frist, i dag) + 7 dager
  const iDag = new Date()
  iDag.setHours(0, 0, 0, 0)
  const gammelFrist = tiltak.frist ? new Date(tiltak.frist) : iDag
  const base = new Date(Math.max(gammelFrist.getTime(), iDag.getTime()))
  base.setDate(base.getDate() + 7)
  const nyFrist = base.toISOString().slice(0, 10)

  const { error } = await supabase
    .from('aktiviteter')
    .update({ frist: nyFrist, updated_by: bruker.id })
    .eq('id', tiltakId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Gjennomslag
// ============================================================

export async function opprettGjennomslag(data: {
  maal_id: string
  nokkelresultat_id?: string | null
  dato: string
  kilde_type: KildeType
  tekst: string
  vurdering: GjennomslagVurdering
  url?: string | null
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const feil = validerTekst(data.tekst, MAX_TEKST, 'Tekst')
  if (feil) return { success: false, error: feil }

  const { data: g, error } = await supabase
    .from('gjennomslag')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      maal_id: data.maal_id,
      nokkelresultat_id: data.nokkelresultat_id || null,
      dato: data.dato,
      kilde_type: data.kilde_type,
      tekst: data.tekst.trim(),
      vurdering: data.vurdering,
      url: data.url?.trim() || null,
      created_by: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: g.id }
}

// ============================================================
// Mål-koblinger (saker og høringer)
// ============================================================

export async function kobleSakTilMaal(maalId: string, sakId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('maal_koblinger')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      maal_id: maalId,
      sak_id: sakId,
    })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Saken er allerede koblet' }
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function kobleHoringTilMaal(maalId: string, horingId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('maal_koblinger')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      maal_id: maalId,
      offentlig_horing_id: horingId,
    })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Høringen er allerede koblet' }
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function fjernMaalKobling(koblingId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('maal_koblinger')
    .delete()
    .eq('id', koblingId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Lenker for mål
// ============================================================

export async function leggTilMaalLenke(maalId: string, tittel: string, url: string, type: LenkeType): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  let fullUrl = url.trim()
  if (fullUrl && !fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://' + fullUrl
  }

  const { error } = await supabase
    .from('lenker')
    .insert({
      maal_id: maalId,
      organisasjon_id: bruker.organisasjon_id,
      tittel: tittel.trim(),
      url: fullUrl,
      type,
      lagt_til_av: bruker.id,
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettMaalLenke(lenkeId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('lenker')
    .delete()
    .eq('id', lenkeId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Statusoppdatering (utenfor møtet)
// ============================================================

export async function opprettStatusoppdatering(data: {
  maal_id: string
  kommentar: string
  sannsynlighet?: Record<string, number>
  tiltak_status?: Record<string, 'gjort' | 'utsett' | 'dropp'>
  nye_tiltak?: Record<string, { tekst: string; ansvarlig_id: string | null; frist: string }[]>
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const feil = validerTekst(data.kommentar, MAX_TEKST, 'Kommentar')
  if (feil) return { success: false, error: feil }

  // Slett eventuell eksisterende ventende oppdatering
  await supabase
    .from('statusoppdateringer')
    .delete()
    .eq('maal_id', data.maal_id)
    .eq('status', 'venter')

  const oppdateringData: Record<string, unknown> = {}
  if (data.sannsynlighet) oppdateringData.sannsynlighet = data.sannsynlighet
  if (data.tiltak_status) oppdateringData.tiltak_status = data.tiltak_status
  if (data.nye_tiltak) oppdateringData.nye_tiltak = data.nye_tiltak

  const { error } = await supabase
    .from('statusoppdateringer')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      maal_id: data.maal_id,
      av_bruker_id: bruker.id,
      kommentar: data.kommentar.trim(),
      data: Object.keys(oppdateringData).length > 0 ? oppdateringData : null,
      status: 'venter',
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Søk i saker og høringer (for kobling)
// ============================================================

export async function sokSakerForKobling(sok: string): Promise<{ id: string; tittel: string; landing: string | null }[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('saker')
    .select('id, tittel, landing')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('arkivert', false)
    .ilike('tittel', `%${sok}%`)
    .limit(10)

  return data ?? []
}

export async function sokHoringerForKobling(sok: string): Promise<{ id: string; tittel: string; horingsfrist: string | null }[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('offentlige_horinger')
    .select('id, tittel, horingsfrist')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('arkivert', false)
    .ilike('tittel', `%${sok}%`)
    .limit(10)

  return data ?? []
}

// ============================================================
// Politisk kvarter
// ============================================================

export async function startPolitiskKvarter(): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  // Sjekk om det allerede pågår et møte
  const { data: pagar } = await supabase
    .from('politisk_kvarter')
    .select('id')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('status', 'pagar')
    .maybeSingle()

  if (pagar) return { success: false, error: 'Et møte pågår allerede', id: pagar.id }

  const { data: pk, error } = await supabase
    .from('politisk_kvarter')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      ordstyrer_id: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: pk.id }
}

export async function hentPolitiskKvarter(pkId: string) {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return null

  const { data: pk } = await supabase
    .from('politisk_kvarter')
    .select(`
      *,
      politisk_kvarter_maal(
        *,
        maal:maal_id(
          *,
          tema(*),
          nokkelresultater(
            *,
            aktiviteter:aktiviteter!nokkelresultat_id(*, brukere:ansvarlig_id(navn))
          ),
          gjennomslag(*),
          maal_koblinger(
            *,
            saker:sak_id(id, tittel, landing, komite_dato, stortings_dato, horingsfrist),
            offentlige_horinger:offentlig_horing_id(id, tittel, horingsfrist)
          ),
          statusoppdateringer!maal_id(*)
        )
      )
    `)
    .eq('id', pkId)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .single()

  return pk
}

export async function opprettPKDagsorden(pkId: string, maalIder: string[]): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  // Slett eksisterende dagsorden
  await supabase
    .from('politisk_kvarter_maal')
    .delete()
    .eq('politisk_kvarter_id', pkId)

  if (maalIder.length === 0) return { success: true }

  const rader = maalIder.map((maalId, i) => ({
    politisk_kvarter_id: pkId,
    maal_id: maalId,
    rekkefolge: i,
    valgt: true,
  }))

  const { error } = await supabase
    .from('politisk_kvarter_maal')
    .insert(rader)

  if (error) return { success: false, error: error.message }

  // Gå til gjennomgang
  await supabase
    .from('politisk_kvarter')
    .update({ fase: 'gjennomgang', aktivt_maal_id: maalIder[0] })
    .eq('id', pkId)

  return { success: true }
}

export async function oppdaterPKMaalUtkast(pkId: string, maalId: string, utkast: {
  kommentar?: string
  sannsynlighet?: Record<string, number>
  tiltak_gjort?: string[]
  tiltak_droppet?: string[]
  tiltak_utsatt?: string[]
  nye_tiltak?: { nokkelresultat_id: string; beskrivelse: string; ansvarlig_id: string | null; frist: string }[]
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('politisk_kvarter_maal')
    .update({
      utkast: utkast,
      kommentar: utkast.kommentar || null,
      sist_endret_av: bruker.id,
      behandlet: true,
    })
    .eq('politisk_kvarter_id', pkId)
    .eq('maal_id', maalId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function avsluttPolitiskKvarter(pkId: string, data: {
  sannsynligheter: Record<string, number>
  tiltak_gjort: string[]
  tiltak_droppet: string[]
  tiltak_utsatt: string[]
  nye_tiltak: { nokkelresultat_id: string; beskrivelse: string; ansvarlig_id: string | null; frist: string }[]
  kommentarer: Record<string, string>
}): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: resultat, error } = await supabase.rpc('avslutt_politisk_kvarter', {
    p_pk_id: pkId,
    p_organisasjon_id: bruker.organisasjon_id,
    p_bruker_id: bruker.id,
    p_sannsynligheter: data.sannsynligheter,
    p_tiltak_gjort: data.tiltak_gjort,
    p_tiltak_droppet: data.tiltak_droppet,
    p_tiltak_utsatt: data.tiltak_utsatt,
    p_nye_tiltak: data.nye_tiltak,
    p_kommentarer: data.kommentarer,
  })

  if (error) return { success: false, error: error.message }
  if (resultat && !resultat.success) return { success: false, error: resultat.error }
  return { success: true }
}

export async function forkastPolitiskKvarter(pkId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('politisk_kvarter')
    .update({ status: 'forkastet' })
    .eq('id', pkId)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('status', 'pagar')

  if (error) return { success: false, error: error.message }
  return { success: true }
}
