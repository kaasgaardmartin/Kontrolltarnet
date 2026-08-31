'use server'

import { createServerSupabaseClient } from './supabase-server'
import { BRREG_BASE, normaliserRoller } from './brreg'

import type { Sak, PartiStemme, Stemme, Niva, Landing, Notat, Lenke, LenkeType, Komite, KomiteMandat, Rolle, Bruker, Stakeholder, SakStakeholder, Aktivitet, StakeholderType, Holdning, Innflytelse, AktivitetType, AktivitetStatus, Varsel, VarselType } from './types'


// ============================================================
// Input-validering hjelpefunksjoner
// ============================================================


const MAX_TITTEL = 300
const MAX_BESKRIVELSE = 5000
const MAX_NOTAT = 10000
const MAX_URL = 2048
const MAX_NAVN = 200

function validerTekst(tekst: string, maxLength: number, feltnavn: string): string | null {
  if (!tekst || tekst.trim().length === 0) return `${feltnavn} kan ikke være tom`
  if (tekst.length > maxLength) return `${feltnavn} kan ikke være lengre enn ${maxLength} tegn`
  return null
}

function validerUrl(url: string): string | null {
  if (!url || url.trim().length === 0) return 'URL kan ikke være tom'
  if (url.length > MAX_URL) return `URL kan ikke være lengre enn ${MAX_URL} tegn`
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'URL må starte med http:// eller https://'
    }
  } catch {
    return 'Ugyldig URL-format'
  }
  return null
}

export interface AktivitetOppsummering {
  antallPlanlagte: number
  nesteFrist: string | null
}

export interface HoringOppsummering {
  /** Nærmeste kommende frist (innspillsfrist eller anmodningsfrist) */
  nesteFrist: string | null
  /** Type: 'innspill' = skriftlig høring, 'anmodning' = påmelding muntlig, 'start' = høringsdato */
  fristType: 'innspill' | 'anmodning' | 'start' | null
  /** Er høringen skriftlig (true) eller muntlig (false) */
  skriftlig: boolean | null
  /** Er det noen aktive høringer (Aktiv / Planlagt) */
  harAktiveHoringer: boolean
}

export interface SakMedStemmer extends Sak {
  partistemmer: PartiStemme[]
  delsaker?: SakMedStemmer[]
  stakeholder_navn?: string[]
  aktivitet_oppsummering?: AktivitetOppsummering
  horing_oppsummering?: HoringOppsummering
}

export interface SakFormData {
  tittel: string
  beskrivelse: string | null
  niva: Niva | null
  landing: Landing | null
  komite_id: string | null
  stortingssak_ref: string | null
  komite_dato: string | null
  stortings_dato: string | null
  forelder_id?: string | null
  sesjon?: string | null
  horingsfrist?: string | null
  horingsnotat_url?: string | null
  horingssvar_url?: string | null
  stemmer: { parti: string; stemme: Stemme }[]
}

export async function hentBrukerOgOrg() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bruker } = await supabase
    .from('brukere')
    .select('id, organisasjon_id, rolle, navn, epost')
    .eq('id', user.id)
    .single()

  // Fallback: Hvis brukeren finnes i auth men ikke i brukere-tabellen
  // (trigger feilet), opprett brukeren her basert på e-postdomenet
  if (!bruker && user.email) {
    const domain = user.email.split('@')[1]?.toLowerCase()
    if (domain) {
      const { data: org } = await supabase
        .from('organisasjoner')
        .select('id')
        .eq('domene', domain)
        .single()

      if (org) {
        const navn = user.user_metadata?.navn
          || user.user_metadata?.full_name
          || user.user_metadata?.name
          || user.email.split('@')[0]

        const { data: nyBruker } = await supabase
          .from('brukere')
          .insert({
            id: user.id,
            organisasjon_id: org.id,
            navn,
            epost: user.email,
            rolle: 'redaktør',
          })
          .select('id, organisasjon_id, rolle, navn')
          .single()

        return nyBruker
      }
    }
  }

  return bruker
}

export async function hentSakerMedStemmer(): Promise<SakMedStemmer[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  // Fetch all non-archived saker with their votes, stakeholder names, activities, and hearings
  const { data: alleSaker } = await supabase
    .from('saker')
    .select('*, partistemmer(*), sak_stakeholders(stakeholders(navn)), aktiviteter(frist, status), horinger(innspillsfrist, anmodningsfrist, start_dato, status, skriftlig)')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('arkivert', false)
    .order('updated_at', { ascending: false })

  const nå = new Date()

  const saker = (alleSaker ?? []).map((s: Record<string, unknown>) => {
    const sakStakeholders = (s.sak_stakeholders ?? []) as { stakeholders: { navn: string } | null }[]
    const stakeholder_navn = sakStakeholders
      .map(ss => ss.stakeholders?.navn)
      .filter((n): n is string => !!n)

    // Beregn aktivitet-oppsummering
    const aktiviteter = (s.aktiviteter ?? []) as { frist: string | null; status: string }[]
    const planlagte = aktiviteter.filter(a => a.status === 'planlagt')
    const frister = planlagte
      .map(a => a.frist)
      .filter((f): f is string => !!f)
      .sort()
    const aktivitet_oppsummering: AktivitetOppsummering = {
      antallPlanlagte: planlagte.length,
      nesteFrist: frister.length > 0 ? frister[0] : null,
    }

    // Beregn høring-oppsummering — finn nærmeste kommende frist
    const horinger = (s.horinger ?? []) as {
      innspillsfrist: string | null
      anmodningsfrist: string | null
      start_dato: string | null
      status: string | null
      skriftlig: boolean
    }[]
    const aktiveStatuser = ['Aktiv', 'Planlagt', 'aktiv', 'planlagt']
    const aktiveHoringer = horinger.filter(h => !h.status || aktiveStatuser.includes(h.status))
    const harAktiveHoringer = aktiveHoringer.length > 0

    // Samle alle frister (fremtidige og passerte) med type og skriftlig-flagg
    // Fremtidige: kun fra aktive/planlagte høringer
    // Passerte: fra alle høringer (inkl. Avholdt) som fallback for å vise siste aktivitet
    type FristEntry = { dato: string; type: 'innspill' | 'anmodning' | 'start'; skriftlig: boolean }
    const fremmedigeFrister: FristEntry[] = []
    const passerateFrister: FristEntry[] = []
    for (const h of horinger) {
      const erAktiv = !h.status || aktiveStatuser.includes(h.status)
      const kandidater: { dato: string | null; type: 'innspill' | 'anmodning' | 'start' }[] = [
        { dato: h.innspillsfrist, type: 'innspill' },
        { dato: h.anmodningsfrist, type: 'anmodning' },
        { dato: h.start_dato, type: 'start' },
      ]
      for (const { dato, type } of kandidater) {
        if (!dato) continue
        const entry: FristEntry = { dato, type, skriftlig: h.skriftlig ?? true }
        if (new Date(dato) >= nå) {
          if (erAktiv) fremmedigeFrister.push(entry) // kun aktive høringer fremover
        } else {
          passerateFrister.push(entry) // alle høringer bakover
        }
      }
    }
    // Foretrekk nærmeste fremtidige frist; fall back til nyligste passerte
    fremmedigeFrister.sort((a, b) => a.dato.localeCompare(b.dato))
    passerateFrister.sort((a, b) => b.dato.localeCompare(a.dato)) // nyligste først
    const nesteFristEntry = fremmedigeFrister[0] ?? passerateFrister[0] ?? null
    const horing_oppsummering: HoringOppsummering = {
      nesteFrist: nesteFristEntry?.dato ?? null,
      fristType: nesteFristEntry?.type ?? null,
      skriftlig: nesteFristEntry?.skriftlig ?? null,
      harAktiveHoringer,
    }

    const { sak_stakeholders: _ss, aktiviteter: _ak, horinger: _ho, ...rest } = s
    return { ...rest, stakeholder_navn, aktivitet_oppsummering, horing_oppsummering } as SakMedStemmer
  })

  // Separate into hovedsaker (no parent) and delsaker (has parent)
  const hovedsaker = saker.filter(s => !s.forelder_id)
  const delsaker = saker.filter(s => s.forelder_id)

  // Nest delsaker under their parent
  for (const hovedsak of hovedsaker) {
    hovedsak.delsaker = delsaker.filter(d => d.forelder_id === hovedsak.id)
  }

  return hovedsaker
}

export async function hentStortingsmandater() {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('stortingssalen_mandater')
    .select('parti, antall')
    .eq('organisasjon_id', bruker.organisasjon_id)

  return data ?? []
}

export async function hentKomiteMandater(komiteId: string) {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('komite_mandater')
    .select('parti, antall')
    .eq('komite_id', komiteId)

  return data ?? []
}

export async function hentKomiteer() {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('komiteer')
    .select('id, navn')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('navn')

  return data ?? []
}

export async function opprettSak(formData: SakFormData): Promise<{ success: boolean; error?: string; sakId?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  // Input-validering
  const tittelFeil = validerTekst(formData.tittel, MAX_TITTEL, 'Tittel')
  if (tittelFeil) return { success: false, error: tittelFeil }
  if (formData.beskrivelse) {
    const beskFeil = validerTekst(formData.beskrivelse, MAX_BESKRIVELSE, 'Beskrivelse')
    if (beskFeil) return { success: false, error: beskFeil }
  }

  // If creating a delsak, inherit fields from parent
  let arvKomiteId = formData.komite_id
  let arvStortingssakRef = formData.stortingssak_ref
  let arvKomiteDato = formData.komite_dato
  let arvStortingsDato = formData.stortings_dato
  let arvNiva = formData.niva
  let arvSesjon = formData.sesjon

  if (formData.forelder_id) {
    const { data: forelder } = await supabase
      .from('saker')
      .select('komite_id, stortingssak_ref, komite_dato, stortings_dato, niva, sesjon')
      .eq('id', formData.forelder_id)
      .single()

    if (forelder) {
      arvKomiteId = arvKomiteId || forelder.komite_id
      arvStortingssakRef = arvStortingssakRef || forelder.stortingssak_ref
      arvKomiteDato = arvKomiteDato || forelder.komite_dato
      arvStortingsDato = arvStortingsDato || forelder.stortings_dato
      arvNiva = arvNiva || forelder.niva
      arvSesjon = arvSesjon || forelder.sesjon
    }
  }

  const { data: sak, error: sakError } = await supabase
    .from('saker')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      tittel: formData.tittel,
      beskrivelse: formData.beskrivelse,
      niva: arvNiva,
      landing: formData.landing || 'ukjent',
      komite_id: arvKomiteId,
      stortingssak_ref: arvStortingssakRef,
      komite_dato: arvKomiteDato || null,
      stortings_dato: arvStortingsDato || null,
      forelder_id: formData.forelder_id || null,
      sesjon: arvSesjon || null,
      horingsfrist: formData.horingsfrist || null,
      horingsnotat_url: formData.horingsnotat_url || null,
      horingssvar_url: formData.horingssvar_url || null,
      created_by: bruker.id,
      eier_id: bruker.id,
    })
    .select('id')
    .single()

  if (sakError || !sak) return { success: false, error: sakError?.message || 'Kunne ikke opprette sak' }

  const stemmerMedSak = formData.stemmer
    .filter(s => s.stemme !== 'ukjent')
    .map(s => ({
      sak_id: sak.id,
      organisasjon_id: bruker.organisasjon_id,
      parti: s.parti,
      stemme: s.stemme,
      updated_by: bruker.id,
    }))

  if (stemmerMedSak.length > 0) {
    const { error: stemmeError } = await supabase
      .from('partistemmer')
      .insert(stemmerMedSak)

    if (stemmeError) return { success: false, error: stemmeError.message }
  }

  // Auto-subscribe creator
  await autoAbonner(bruker.id, sak.id)

  return { success: true, sakId: sak.id }
}

export async function oppdaterSak(sakId: string, formData: SakFormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  // Fetch current state to detect changes
  const { data: gjeldende } = await supabase
    .from('saker')
    .select('landing')
    .eq('id', sakId)
    .single()

  const { error: sakError } = await supabase
    .from('saker')
    .update({
      tittel: formData.tittel,
      beskrivelse: formData.beskrivelse,
      niva: formData.niva,
      landing: formData.landing,
      komite_id: formData.komite_id,
      stortingssak_ref: formData.stortingssak_ref,
      komite_dato: formData.komite_dato || null,
      stortings_dato: formData.stortings_dato || null,
      sesjon: formData.sesjon || null,
      horingsfrist: formData.horingsfrist || null,
      horingsnotat_url: formData.horingsnotat_url || null,
      horingssvar_url: formData.horingssvar_url || null,
    })
    .eq('id', sakId)

  if (sakError) return { success: false, error: sakError.message }

  // Upsert all party votes
  for (const s of formData.stemmer) {
    await supabase
      .from('partistemmer')
      .upsert(
        {
          sak_id: sakId,
          organisasjon_id: bruker.organisasjon_id,
          parti: s.parti,
          stemme: s.stemme,
          updated_by: bruker.id,
        },
        { onConflict: 'sak_id,parti' }
      )
  }

  // Notify if landing changed
  if (gjeldende && gjeldende.landing !== formData.landing) {
    await opprettVarsler(sakId, 'landing', `Landing endret til «${formData.landing}»`, bruker.id)
  }

  return { success: true }
}

// Oppdaterer partistemmer (og eventuelt landing) på en eksisterende sak
// Hopper over stemmer med 'ukjent' for å ikke overskrive eksisterende data
export async function oppdaterPartistemmer(
  sakId: string,
  stemmer: { parti: string; stemme: string }[],
  landing?: 'vedtatt' | 'faller' | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  // Kun upsert stemmer vi faktisk har data for (ikke ukjent)
  const aktive = stemmer.filter(s => s.stemme !== 'ukjent')
  if (aktive.length === 0) return { success: false, error: 'Ingen stemmedata funnet i voteringen' }

  for (const s of aktive) {
    await supabase
      .from('partistemmer')
      .upsert(
        {
          sak_id: sakId,
          organisasjon_id: bruker.organisasjon_id,
          parti: s.parti,
          stemme: s.stemme,
          updated_by: bruker.id,
        },
        { onConflict: 'sak_id,parti' }
      )
  }

  // Oppdater landing hvis angitt
  if (landing) {
    await supabase
      .from('saker')
      .update({ landing })
      .eq('id', sakId)
  }

  return { success: true }
}

export async function slettSak(sakId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('saker')
    .delete()
    .eq('id', sakId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Saksdetaljer
// ============================================================

export interface SakDetaljer extends Sak {
  partistemmer: PartiStemme[]
  noter: (Notat & { brukere: { navn: string } | null })[]
  lenker: Lenke[]
  komiteer: { navn: string } | null
  delsaker?: SakMedStemmer[]
  sak_stakeholders?: SakStakeholder[]
  aktiviteter?: Aktivitet[]
}

export async function hentSak(sakId: string): Promise<SakDetaljer | null> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return null

  const { data } = await supabase
    .from('saker')
    .select('*, partistemmer(*), noter(*, brukere(navn)), lenker(*), komiteer(navn)')
    .eq('id', sakId)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .single()

  if (!data) return null

  // Sort noter by created_at desc
  const sak = data as unknown as SakDetaljer
  sak.noter = (sak.noter ?? []).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  sak.lenker = sak.lenker ?? []

  // Fetch delsaker
  const { data: delsaker } = await supabase
    .from('saker')
    .select('*, partistemmer(*)')
    .eq('forelder_id', sakId)
    .eq('arkivert', false)
    .order('created_at', { ascending: true })

  sak.delsaker = (delsaker ?? []) as SakMedStemmer[]

  // Fetch stakeholders
  const { data: sakStakeholders } = await supabase
    .from('sak_stakeholders')
    .select('*, stakeholders(*)')
    .eq('sak_id', sakId)
    .order('created_at', { ascending: true })

  sak.sak_stakeholders = (sakStakeholders ?? []) as SakStakeholder[]

  // Fetch aktiviteter
  const { data: aktiviteter } = await supabase
    .from('aktiviteter')
    .select('*, stakeholders(navn), brukere:ansvarlig_id(navn)')
    .eq('sak_id', sakId)
    .order('frist', { ascending: true, nullsFirst: false })

  sak.aktiviteter = (aktiviteter ?? []) as Aktivitet[]

  return sak
}

export async function leggTilNotat(sakId: string, tekst: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const notatFeil = validerTekst(tekst, MAX_NOTAT, 'Notat')
  if (notatFeil) return { success: false, error: notatFeil }

  const { error } = await supabase.from('noter').insert({
    sak_id: sakId,
    organisasjon_id: bruker.organisasjon_id,
    tekst,
    forfatter_id: bruker.id,
  })

  if (error) return { success: false, error: error.message }

  // Auto-subscribe and notify
  await autoAbonner(bruker.id, sakId)
  const kort = tekst.length > 60 ? tekst.slice(0, 57) + '...' : tekst
  await opprettVarsler(sakId, 'notat', `Nytt notat: «${kort}»`, bruker.id)

  return { success: true }
}

export async function leggTilLenke(
  sakId: string,
  tittel: string,
  url: string,
  type: LenkeType
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const tittelFeil = validerTekst(tittel, MAX_TITTEL, 'Tittel')
  if (tittelFeil) return { success: false, error: tittelFeil }
  const urlFeil = validerUrl(url)
  if (urlFeil) return { success: false, error: urlFeil }

  const { error } = await supabase.from('lenker').insert({
    sak_id: sakId,
    organisasjon_id: bruker.organisasjon_id,
    tittel,
    url,
    type,
    lagt_til_av: bruker.id,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettLenke(lenkeId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: lenke } = await supabase.from('lenker').select('sak_id').eq('id', lenkeId).single()
  if (!lenke) return { success: false, error: 'Ikke funnet' }

  const { data: sak } = await supabase.from('saker').select('id').eq('id', lenke.sak_id).eq('organisasjon_id', bruker.organisasjon_id).single()
  if (!sak) return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase.from('lenker').delete().eq('id', lenkeId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function endreSakNiva(sakId: string, niva: 'storting' | 'departement' | 'intern'): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('saker')
    .update({ niva })
    .eq('id', sakId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function arkiverSak(sakId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const now = new Date().toISOString()

  // Arkiver hovedsaken
  const { error } = await supabase
    .from('saker')
    .update({ arkivert: true, arkivert_dato: now })
    .eq('id', sakId)

  if (error) return { success: false, error: error.message }

  // Arkiver eventuelle delsaker
  await supabase
    .from('saker')
    .update({ arkivert: true, arkivert_dato: now })
    .eq('forelder_id', sakId)

  return { success: true }
}

export async function registrerUtfall(
  sakId: string,
  utfall: 'vedtatt' | 'ikke_vedtatt' | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('saker')
    .update({
      utfall,
      utfall_dato: utfall ? new Date().toISOString() : null,
    })
    .eq('id', sakId)

  if (error) return { success: false, error: error.message }

  if (utfall) {
    const label = utfall === 'vedtatt' ? 'Vedtatt' : 'Ikke vedtatt'
    await opprettVarsler(sakId, 'utfall', `Utfall registrert: ${label}`, bruker.id)
  }

  return { success: true }
}

export async function gjenopprettSak(sakId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('saker')
    .update({ arkivert: false, arkivert_dato: null })
    .eq('id', sakId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Arkiv
// ============================================================

export async function hentArkiverteSaker(): Promise<SakMedStemmer[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('saker')
    .select('*, partistemmer(*)')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('arkivert', true)
    .order('arkivert_dato', { ascending: false })

  const saker = (data ?? []) as SakMedStemmer[]

  // Grupper delsaker under hovedsaker
  const hovedsaker = saker.filter(s => !s.forelder_id)
  const delsaker = saker.filter(s => s.forelder_id)

  for (const hovedsak of hovedsaker) {
    hovedsak.delsaker = delsaker.filter(d => d.forelder_id === hovedsak.id)
  }

  return hovedsaker
}

// ============================================================
// Komité-admin
// ============================================================

export interface KomiteMedMandater extends Komite {
  komite_mandater: KomiteMandat[]
}

export async function hentKomiteerMedMandater(): Promise<KomiteMedMandater[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('komiteer')
    .select('*, komite_mandater(*)')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('navn')

  return (data ?? []) as KomiteMedMandater[]
}

export async function opprettKomite(navn: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data, error } = await supabase
    .from('komiteer')
    .insert({ organisasjon_id: bruker.organisasjon_id, navn })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function oppdaterKomite(komiteId: string, navn: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase.from('komiteer').update({ navn }).eq('id', komiteId).eq('organisasjon_id', bruker.organisasjon_id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettKomite(komiteId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle !== 'org-admin') return { success: false, error: 'Kun org-admin kan slette komiteer' }

  const { error } = await supabase.from('komiteer').delete().eq('id', komiteId).eq('organisasjon_id', bruker.organisasjon_id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function oppdaterKomiteMandater(
  komiteId: string,
  mandater: { parti: string; antall: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: komite } = await supabase.from('komiteer').select('id').eq('id', komiteId).eq('organisasjon_id', bruker.organisasjon_id).single()
  if (!komite) return { success: false, error: 'Ingen tilgang' }

  for (const m of mandater) {
    await supabase
      .from('komite_mandater')
      .upsert(
        { komite_id: komiteId, parti: m.parti, antall: m.antall },
        { onConflict: 'komite_id,parti' }
      )
  }

  return { success: true }
}

export async function oppdaterStortingsmandater(
  mandater: { parti: string; antall: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  for (const m of mandater) {
    await supabase
      .from('stortingssalen_mandater')
      .upsert(
        { organisasjon_id: bruker.organisasjon_id, parti: m.parti, antall: m.antall },
        { onConflict: 'organisasjon_id,parti' }
      )
  }

  return { success: true }
}

// ============================================================
// Høringer
// ============================================================

export interface Horing {
  id: string
  sak_id: string
  horing_id: string
  tittel: string | null
  skriftlig: boolean
  innspillsfrist: string | null
  anmodningsfrist: string | null
  start_dato: string | null
  status: string | null
  created_at: string
}

export async function hentHoringer(sakId: string): Promise<Horing[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('horinger')
    .select('*')
    .eq('sak_id', sakId)
    .order('innspillsfrist', { ascending: true })

  return (data ?? []) as Horing[]
}

export async function lagreHoringer(
  sakId: string,
  horinger: { horing_id: string; tittel: string; skriftlig: boolean; innspillsfrist: string | null; anmodningsfrist: string | null; start_dato: string | null; status: string }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const rader = horinger.map(h => ({
    sak_id: sakId,
    organisasjon_id: bruker.organisasjon_id,
    horing_id: h.horing_id,
    tittel: h.tittel,
    skriftlig: h.skriftlig,
    innspillsfrist: h.innspillsfrist,
    anmodningsfrist: h.anmodningsfrist,
    start_dato: h.start_dato,
    status: h.status,
  }))

  const { error } = await supabase
    .from('horinger')
    .upsert(rader, { onConflict: 'sak_id,horing_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettHoring(horingId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: horing } = await supabase.from('horinger').select('sak_id').eq('id', horingId).single()
  if (!horing) return { success: false, error: 'Ikke funnet' }

  const { data: sak } = await supabase.from('saker').select('id').eq('id', horing.sak_id).eq('organisasjon_id', bruker.organisasjon_id).single()
  if (!sak) return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase.from('horinger').delete().eq('id', horingId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Brukeradministrasjon
// ============================================================

export async function hentBrukere(): Promise<Bruker[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []
  if (bruker.rolle !== 'org-admin') return []

  const { data } = await supabase
    .from('brukere')
    .select('*')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('created_at', { ascending: true })

  return (data ?? []) as Bruker[]
}

export async function oppdaterBrukerRolle(
  brukerId: string,
  rolle: Rolle
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle !== 'org-admin') return { success: false, error: 'Kun org-admin kan endre roller' }
  if (bruker.id === brukerId) return { success: false, error: 'Du kan ikke endre din egen rolle' }

  const { error } = await supabase
    .from('brukere')
    .update({ rolle })
    .eq('id', brukerId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function oppdaterBrukerStatus(
  brukerId: string,
  aktiv: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle !== 'org-admin') return { success: false, error: 'Kun org-admin kan endre brukerstatus' }
  if (bruker.id === brukerId) return { success: false, error: 'Du kan ikke deaktivere deg selv' }

  const { error } = await supabase
    .from('brukere')
    .update({ aktiv })
    .eq('id', brukerId)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Stakeholders
// ============================================================

export async function hentStakeholders(): Promise<Stakeholder[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('navn')

  return (data ?? []) as Stakeholder[]
}

export async function opprettStakeholder(
  navn: string,
  type: StakeholderType,
  kontaktinfo?: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const navnFeil = validerTekst(navn, MAX_NAVN, 'Navn')
  if (navnFeil) return { success: false, error: navnFeil }

  const { data, error } = await supabase
    .from('stakeholders')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      navn,
      type,
      kontaktinfo: kontaktinfo || null,
      created_by: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function leggTilSakStakeholder(
  sakId: string,
  stakeholderId: string,
  holdning: Holdning,
  innflytelse: Innflytelse,
  notat?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('sak_stakeholders')
    .upsert({
      sak_id: sakId,
      stakeholder_id: stakeholderId,
      organisasjon_id: bruker.organisasjon_id,
      holdning,
      innflytelse,
      notat: notat || null,
    }, { onConflict: 'sak_id,stakeholder_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function oppdaterSakStakeholder(
  id: string,
  holdning: Holdning,
  innflytelse: Innflytelse,
  notat?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('sak_stakeholders')
    .update({ holdning, innflytelse, notat: notat || null })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function fjernSakStakeholder(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: stakeholder } = await supabase.from('sak_stakeholders').select('sak_id').eq('id', id).single()
  if (!stakeholder) return { success: false, error: 'Ikke funnet' }

  const { data: sak } = await supabase.from('saker').select('id').eq('id', stakeholder.sak_id).eq('organisasjon_id', bruker.organisasjon_id).single()
  if (!sak) return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase.from('sak_stakeholders').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Høring
// ============================================================

export async function oppdaterHoring(
  sakId: string,
  data: {
    horingsfrist?: string | null
    horingsnotat_url?: string | null
    horingssvar_url?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  if (data.horingsnotat_url) {
    const urlFeil = validerUrl(data.horingsnotat_url)
    if (urlFeil) return { success: false, error: `Høringsnotat: ${urlFeil}` }
  }
  if (data.horingssvar_url) {
    const urlFeil = validerUrl(data.horingssvar_url)
    if (urlFeil) return { success: false, error: `Høringssvar: ${urlFeil}` }
  }

  const { error } = await supabase
    .from('saker')
    .update({
      horingsfrist: data.horingsfrist || null,
      horingsnotat_url: data.horingsnotat_url || null,
      horingssvar_url: data.horingssvar_url || null,
    })
    .eq('id', sakId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Aktiviteter
// ============================================================

export async function opprettAktivitet(
  sakId: string,
  aktivitetData: {
    type: AktivitetType
    beskrivelse: string
    frist?: string | null
    stakeholder_id?: string | null
    ansvarlig_id?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const beskFeil = validerTekst(aktivitetData.beskrivelse, MAX_BESKRIVELSE, 'Beskrivelse')
  if (beskFeil) return { success: false, error: beskFeil }

  const { data: nyAktivitet, error } = await supabase.from('aktiviteter').insert({
    sak_id: sakId,
    organisasjon_id: bruker.organisasjon_id,
    type: aktivitetData.type,
    beskrivelse: aktivitetData.beskrivelse,
    frist: aktivitetData.frist || null,
    stakeholder_id: aktivitetData.stakeholder_id || null,
    ansvarlig_id: aktivitetData.ansvarlig_id || null,
    created_by: bruker.id,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  const aktivitetId = nyAktivitet?.id

  await opprettVarsler(sakId, 'aktivitet', `Ny aktivitet: ${aktivitetData.beskrivelse}`, bruker.id, aktivitetId)

  // Notify assigned user directly
  if (aktivitetData.ansvarlig_id && aktivitetData.ansvarlig_id !== bruker.id) {
    const supabase2 = await createServerSupabaseClient()
    await supabase2.from('varsler').insert({
      bruker_id: aktivitetData.ansvarlig_id,
      sak_id: sakId,
      type: 'tildelt' as const,
      melding: `Du er tildelt en oppgave: ${aktivitetData.beskrivelse}`,
      aktivitet_id: aktivitetId,
    })
  }

  return { success: true }
}

export async function oppdaterAktivitetStatus(
  aktivitetId: string,
  status: AktivitetStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  // Fetch sak_id before update
  const { data: aktivitet } = await supabase
    .from('aktiviteter')
    .select('sak_id, beskrivelse')
    .eq('id', aktivitetId)
    .single()

  const { error } = await supabase
    .from('aktiviteter')
    .update({ status })
    .eq('id', aktivitetId)

  if (error) return { success: false, error: error.message }

  if (aktivitet?.sak_id) {
    const statusLabel = status === 'utført' ? 'utført' : status === 'avlyst' ? 'avlyst' : 'planlagt'
    await opprettVarsler(aktivitet.sak_id, 'aktivitet', `Aktivitet ${statusLabel}: ${aktivitet.beskrivelse}`, bruker.id, aktivitetId)

    // Mark old notifications about this activity as read (e.g. "tildelt" notifications)
    if (status === 'utført' || status === 'avlyst') {
      await supabase
        .from('varsler')
        .update({ lest: true })
        .eq('aktivitet_id', aktivitetId)
        .eq('lest', false)
    }
  }

  return { success: true }
}

export async function oppdaterAktivitetAnsvarlig(
  aktivitetId: string,
  ansvarligId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('aktiviteter')
    .update({ ansvarlig_id: ansvarligId })
    .eq('id', aktivitetId)

  if (error) return { success: false, error: error.message }

  return { success: true }
}

export async function slettAktivitet(aktivitetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { data: aktivitet } = await supabase
    .from('aktiviteter')
    .select('sak_id, beskrivelse')
    .eq('id', aktivitetId)
    .single()
  if (!aktivitet) return { success: false, error: 'Ikke funnet' }

  const { data: sak } = await supabase.from('saker').select('id').eq('id', aktivitet.sak_id).eq('organisasjon_id', bruker.organisasjon_id).single()
  if (!sak) return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase.from('aktiviteter').delete().eq('id', aktivitetId)
  if (error) return { success: false, error: error.message }

  // Notify subscribers that the activity was deleted
  if (aktivitet?.sak_id) {
    await opprettVarsler(aktivitet.sak_id, 'aktivitet', `Aktivitet slettet: ${aktivitet.beskrivelse}`, bruker.id)
  }

  return { success: true }
}

export async function hentKommendeAktiviteter(): Promise<(Aktivitet & { saker: { id: string; tittel: string } | null })[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('aktiviteter')
    .select('*, stakeholders(navn), brukere:ansvarlig_id(navn), saker(id, tittel)')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('status', 'planlagt')
    .order('frist', { ascending: true, nullsFirst: false })
    .limit(20)

  return (data ?? []) as (Aktivitet & { saker: { id: string; tittel: string } | null })[]
}

export async function hentOrgBrukere(): Promise<{ id: string; navn: string; epost: string }[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('brukere')
    .select('id, navn, epost')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('aktiv', true)
    .order('navn')

  return data ?? []
}

export async function hentMineAktiviteter(): Promise<(Aktivitet & { saker: { id: string; tittel: string } | null })[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('aktiviteter')
    .select('*, stakeholders(navn), brukere:ansvarlig_id(navn), saker(id, tittel)')
    .or(`ansvarlig_id.eq.${bruker.id},created_by.eq.${bruker.id}`)
    .order('status', { ascending: true })
    .order('frist', { ascending: true, nullsFirst: false })

  return (data ?? []) as (Aktivitet & { saker: { id: string; tittel: string } | null })[]
}

// ============================================================
// Varsler (notifications)
// ============================================================

async function opprettVarsler(
  sakId: string,
  type: VarselType,
  melding: string,
  ekskluderBrukerId: string,
  aktivitetId?: string
) {
  const supabase = await createServerSupabaseClient()

  const { data: abonnenter } = await supabase
    .from('varsel_innstillinger')
    .select('bruker_id')
    .eq('sak_id', sakId)
    .eq('aktiv', true)
    .neq('bruker_id', ekskluderBrukerId)

  if (!abonnenter || abonnenter.length === 0) return

  const varsler = abonnenter.map(a => ({
    bruker_id: a.bruker_id,
    sak_id: sakId,
    type,
    melding,
    ...(aktivitetId ? { aktivitet_id: aktivitetId } : {}),
  }))

  await supabase.from('varsler').insert(varsler)
}

async function autoAbonner(brukerId: string, sakId: string) {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from('varsel_innstillinger')
    .upsert(
      { bruker_id: brukerId, sak_id: sakId, aktiv: true },
      { onConflict: 'bruker_id,sak_id' }
    )
}

export async function hentVarsler(): Promise<Varsel[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('varsler')
    .select('*, saker(tittel)')
    .eq('bruker_id', bruker.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []) as Varsel[]
}

export async function hentAntallUlesteVarsler(): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return 0

  const { count } = await supabase
    .from('varsler')
    .select('id', { count: 'exact', head: true })
    .eq('bruker_id', bruker.id)
    .eq('lest', false)

  return count ?? 0
}

export async function markerVarselLest(varselId: string) {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from('varsler')
    .update({ lest: true })
    .eq('id', varselId)
}

export async function markerAlleVarslerLest() {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return

  await supabase
    .from('varsler')
    .update({ lest: true })
    .eq('bruker_id', bruker.id)
    .eq('lest', false)
}

export async function toggleSakAbonnement(sakId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return false

  const { data: existing } = await supabase
    .from('varsel_innstillinger')
    .select('id, aktiv')
    .eq('bruker_id', bruker.id)
    .eq('sak_id', sakId)
    .single()

  if (existing) {
    const nyAktiv = !existing.aktiv
    await supabase
      .from('varsel_innstillinger')
      .update({ aktiv: nyAktiv })
      .eq('id', existing.id)
    return nyAktiv
  } else {
    await supabase
      .from('varsel_innstillinger')
      .insert({ bruker_id: bruker.id, sak_id: sakId, aktiv: true })
    return true
  }
}

export async function hentSakAbonnement(sakId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return false

  const { data } = await supabase
    .from('varsel_innstillinger')
    .select('aktiv')
    .eq('bruker_id', bruker.id)
    .eq('sak_id', sakId)
    .single()

  return data?.aktiv ?? false
}

// ============================================================
// Offentlige høringer (regjeringen.no)
// ============================================================

export type OffentligHoringStatus = 'innkommet' | 'til_vurdering' | 'svarer' | 'svarer_ikke' | 'levert' | 'arkivert'
export type HoringType = 'skriftlig' | 'muntlig' | 'begge'

export interface OffentligHoringVedlegg {
  tittel: string
  url: string
  type: 'horingsbrev' | 'horingsnotat' | 'annet'
}

export interface OffentligHoring {
  id: string
  organisasjon_id: string
  tittel: string
  departement: string | null
  regjeringen_url: string | null
  referanse: string | null
  publisert_dato: string | null
  horingsfrist: string | null
  horing_type: HoringType | null
  beskrivelse: string | null
  horing_instanser: string[]
  vedlegg: OffentligHoringVedlegg[]
  status: OffentligHoringStatus
  utvalg: string[]            // kan tildeles flere utvalg
  hoved_utvalg: string | null // lead-utvalg ved flere utvalg
  ansvarlig_id: string | null
  intern_frist: string | null
  intern_notat: string | null
  horingsbrev_edocs: string | null
  horingssvar_edocs: string | null
  oversendelsesbrev_edocs: string | null
  svar_publisert_url: string | null
  opprettet_av: string | null
  created_at: string
  updated_at: string
  // Joined
  ansvarlig?: { navn: string } | null
  opprettet_av_bruker?: { navn: string } | null
}

export async function hentOffentligeHoringer(): Promise<OffentligHoring[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('offentlige_horinger')
    .select(`
      *,
      ansvarlig:brukere!ansvarlig_id(navn),
      opprettet_av_bruker:brukere!opprettet_av(navn)
    `)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .neq('status', 'arkivert')
    .order('created_at', { ascending: false })

  return (data ?? []) as OffentligHoring[]
}

export async function hentArkiverteHoringer(): Promise<OffentligHoring[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('offentlige_horinger')
    .select(`
      *,
      ansvarlig:brukere!ansvarlig_id(navn),
      opprettet_av_bruker:brukere!opprettet_av(navn)
    `)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('status', 'arkivert')
    .order('updated_at', { ascending: false })

  return (data ?? []) as OffentligHoring[]
}

export async function arkiverHoring(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('offentlige_horinger')
    .update({ status: 'arkivert' })
    .eq('id', id)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function gjenopprettHoring(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('offentlige_horinger')
    .update({ status: 'innkommet' })
    .eq('id', id)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function hentOffentligHoring(id: string): Promise<OffentligHoring | null> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return null

  const { data } = await supabase
    .from('offentlige_horinger')
    .select(`
      *,
      ansvarlig:brukere!ansvarlig_id(navn),
      opprettet_av_bruker:brukere!opprettet_av(navn)
    `)
    .eq('id', id)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .single()

  return data as OffentligHoring | null
}

export async function opprettOffentligHoring(input: {
  tittel: string
  departement?: string | null
  regjeringen_url?: string | null
  referanse?: string | null
  publisert_dato?: string | null
  horingsfrist?: string | null
  horing_type?: HoringType | null
  beskrivelse?: string | null
  horing_instanser?: string[]
  vedlegg?: OffentligHoringVedlegg[]
  status?: OffentligHoringStatus
  utvalg?: string[]
  hoved_utvalg?: string | null
  ansvarlig_id?: string | null
  intern_frist?: string | null
  intern_notat?: string | null
  horingsbrev_edocs?: string | null
  horingssvar_edocs?: string | null
  oversendelsesbrev_edocs?: string | null
  svar_publisert_url?: string | null
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const tittelFeil = validerTekst(input.tittel, MAX_TITTEL, 'Tittel')
  if (tittelFeil) return { success: false, error: tittelFeil }

  const { data, error } = await supabase
    .from('offentlige_horinger')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      tittel: input.tittel,
      departement: input.departement || null,
      regjeringen_url: input.regjeringen_url || null,
      referanse: input.referanse || null,
      publisert_dato: input.publisert_dato || null,
      horingsfrist: input.horingsfrist || null,
      horing_type: input.horing_type || null,
      beskrivelse: input.beskrivelse || null,
      horing_instanser: input.horing_instanser || [],
      vedlegg: input.vedlegg || [],
      status: input.status || 'innkommet',
      utvalg: input.utvalg || [],
      hoved_utvalg: input.hoved_utvalg || null,
      ansvarlig_id: input.ansvarlig_id || null,
      intern_frist: input.intern_frist || null,
      intern_notat: input.intern_notat || null,
      horingsbrev_edocs: input.horingsbrev_edocs || null,
      horingssvar_edocs: input.horingssvar_edocs || null,
      oversendelsesbrev_edocs: input.oversendelsesbrev_edocs || null,
      svar_publisert_url: input.svar_publisert_url || null,
      opprettet_av: bruker.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function oppdaterOffentligHoring(
  id: string,
  input: Partial<{
    tittel: string
    departement: string | null
    regjeringen_url: string | null
    referanse: string | null
    publisert_dato: string | null
    horingsfrist: string | null
    horing_type: HoringType | null
    beskrivelse: string | null
    horing_instanser: string[]
    vedlegg: OffentligHoringVedlegg[]
    status: OffentligHoringStatus
    utvalg: string[]
    hoved_utvalg: string | null
    ansvarlig_id: string | null
    intern_frist: string | null
    intern_notat: string | null
    horingsbrev_edocs: string | null
    horingssvar_edocs: string | null
    oversendelsesbrev_edocs: string | null
    svar_publisert_url: string | null
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  if (input.tittel) {
    const tittelFeil = validerTekst(input.tittel, MAX_TITTEL, 'Tittel')
    if (tittelFeil) return { success: false, error: tittelFeil }
  }

  const { error } = await supabase
    .from('offentlige_horinger')
    .update(input)
    .eq('id', id)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettOffentligHoring(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('offentlige_horinger')
    .delete()
    .eq('id', id)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Send høring til ansvarlig ──────────────────────────────────────────────

export async function sendHoringEpostTilAnsvarlig(
  horingId: string,
  ansvarligIdOverride?: string   // sendes fra klient i tilfelle DB ikke er lagret ennå
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const avsender = await hentBrukerOgOrg() as Awaited<ReturnType<typeof hentBrukerOgOrg>> & { epost: string } | null
  if (!avsender) return { success: false, error: 'Ikke innlogget' }

  // Hent høringen
  const { data: h, error: hErr } = await supabase
    .from('offentlige_horinger')
    .select('*')
    .eq('id', horingId)
    .eq('organisasjon_id', avsender.organisasjon_id)
    .single()
  if (hErr || !h) return { success: false, error: 'Høring ikke funnet' }

  // Bruk override-id fra klient, ellers fall tilbake til det som er lagret
  const ansvarligId = ansvarligIdOverride || h.ansvarlig_id
  if (!ansvarligId) return { success: false, error: 'Ingen ansvarlig er satt på høringen' }

  // Slå opp brukerens e-post separat (unngår join-problemer)
  const { data: ansvarlig } = await supabase
    .from('brukere')
    .select('navn, epost')
    .eq('id', ansvarligId)
    .single()

  if (!ansvarlig) return { success: false, error: 'Ansvarlig bruker ikke funnet' }
  if (!ansvarlig.epost) return { success: false, error: 'Ansvarlig mangler e-postadresse i systemet' }

  const { sendHoringTilBehandlingEpost } = await import('@/lib/email')
  return sendHoringTilBehandlingEpost({
    tilEpost: ansvarlig.epost,
    tilNavn: ansvarlig.navn,
    avsenderNavn: avsender.navn,
    avsenderEpost: avsender.epost,
    tittel: h.tittel,
    departement: h.departement ?? '',
    horingsfrist: h.horingsfrist,
    internFrist: h.intern_frist,
    utvalg: h.utvalg ?? [],
    regjeringenUrl: h.regjeringen_url,
    vedlegg: (h.vedlegg ?? []) as { tittel: string; url: string; type: string }[],
  })
}

// ─── Min side / varslingsinnstillinger ─────────────────────────────────────

export interface EpostInnstillinger {
  epost_oppgave_tildelt: boolean
  epost_fristpaminnelse: boolean
  epost_horingsfrist: boolean
  epost_sakoppdatering: boolean
  epost_horing_til_behandling: boolean
  epost_mandagsliste: boolean
  epost_organisasjon: boolean
}

export async function hentEpostInnstillinger(): Promise<EpostInnstillinger | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('brukere')
    .select('epost_oppgave_tildelt, epost_fristpaminnelse, epost_horingsfrist, epost_sakoppdatering, epost_horing_til_behandling, epost_mandagsliste, epost_organisasjon')
    .eq('id', user.id)
    .single()

  return data ?? null
}

export async function sendTestHoringEpost(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg() as Awaited<ReturnType<typeof hentBrukerOgOrg>> & { epost: string; navn: string } | null
  if (!bruker) return { success: false, error: 'Ikke innlogget' }

  // Hent nyeste høring i organisasjonen som eksempel
  const { data: h } = await supabase
    .from('offentlige_horinger')
    .select('*')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!h) return { success: false, error: 'Ingen høringer funnet å teste med' }

  const { sendHoringTilBehandlingEpost } = await import('@/lib/email')
  return sendHoringTilBehandlingEpost({
    tilEpost: bruker.epost,
    tilNavn: bruker.navn,
    avsenderNavn: bruker.navn,
    avsenderEpost: bruker.epost,
    tittel: h.tittel,
    departement: h.departement ?? '',
    horingsfrist: h.horingsfrist,
    internFrist: h.intern_frist,
    utvalg: h.utvalg ?? [],
    regjeringenUrl: h.regjeringen_url,
    vedlegg: (h.vedlegg ?? []) as { tittel: string; url: string; type: string }[],
  })
}

export async function sendTestMandagsliste(): Promise<{ success: boolean; antall?: number; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg() as Awaited<ReturnType<typeof hentBrukerOgOrg>> & { epost: string; navn: string } | null
  if (!bruker) return { success: false, error: 'Ikke innlogget' }

  const { data: horinger } = await supabase
    .from('offentlige_horinger')
    .select('tittel, departement, utvalg, horingsfrist, intern_frist, regjeringen_url, status')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .in('status', ['innkommet', 'til_vurdering', 'svarer'])
    .order('intern_frist', { ascending: true, nullsFirst: false })

  const liste = horinger ?? []
  const datoDag = new Date().toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const { sendMandagslisteEpost } = await import('@/lib/email')
  const res = await sendMandagslisteEpost({
    tilEpost: bruker.epost,
    tilNavn: bruker.navn,
    dato: datoDag,
    horinger: liste.map((h: any) => ({
      tittel: h.tittel,
      departement: h.departement,
      utvalg: h.utvalg ?? [],
      horingsfrist: h.horingsfrist,
      internFrist: h.intern_frist,
      regjeringenUrl: h.regjeringen_url,
      status: h.status,
    })),
  })

  if (!res.success) return { success: false, error: res.error }
  return { success: true, antall: liste.length }
}

export async function sendTestOrganisasjonsendring(): Promise<{ success: boolean; error?: string }> {
  const bruker = await hentBrukerOgOrg() as Awaited<ReturnType<typeof hentBrukerOgOrg>> & { epost: string; navn: string } | null
  if (!bruker) return { success: false, error: 'Ikke innlogget' }

  const { sendOrganisasjonsendringEpost } = await import('@/lib/email')
  return sendOrganisasjonsendringEpost({
    tilEpost: bruker.epost,
    tilNavn: bruker.navn,
    endringer: [
      { orgNavn: 'Wikborg Rein Advokatfirma AS', orgnr: '916782195', beskrivelse: 'Ola Nordmann er ny styrets leder i Wikborg Rein Advokatfirma AS', endringType: 'ny_rolle' },
      { orgNavn: 'Wikborg Rein Advokatfirma AS', orgnr: '916782195', beskrivelse: 'Kari Hansen er ikke lenger styrets leder i Wikborg Rein Advokatfirma AS', endringType: 'fjernet_rolle' },
      { orgNavn: 'Thommessen AS', orgnr: '957423248', beskrivelse: 'Per Olsen er ny daglig leder i Thommessen AS', endringType: 'ny_rolle' },
    ],
  })
}

export async function oppdaterEpostInnstillinger(
  innstillinger: Partial<EpostInnstillinger>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Ikke innlogget' }

  const { error } = await supabase
    .from('brukere')
    .update(innstillinger)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function hentMinBrukerProfil() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('brukere')
    .select(`
      id, navn, epost, rolle, created_at,
      epost_oppgave_tildelt, epost_fristpaminnelse,
      epost_horingsfrist, epost_sakoppdatering, epost_horing_til_behandling, epost_mandagsliste, epost_organisasjon,
      organisasjoner(navn)
    `)
    .eq('id', user.id)
    .single()

  return data ?? null
}

// ─── Lovutvalg ──────────────────────────────────────────────────────────────

export interface LovutvalgMedlem {
  id: string
  navn: string
  epost: string
}

export interface Lovutvalg {
  id: string
  navn: string
  medlemmer: LovutvalgMedlem[]
}

export async function hentLovutvalg(): Promise<Lovutvalg[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('lovutvalg')
    .select('id, navn, lovutvalg_medlemmer(id, navn, epost)')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('navn')

  return (data ?? []).map((u: any) => ({
    id: u.id,
    navn: u.navn,
    medlemmer: u.lovutvalg_medlemmer ?? [],
  }))
}

export async function hentLovutvalgForHoring(utvalgNavn: string[]): Promise<{ utvalg: string; medlemmer: LovutvalgMedlem[] }[]> {
  if (utvalgNavn.length === 0) return []
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('lovutvalg')
    .select('id, navn, lovutvalg_medlemmer(id, navn, epost)')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .in('navn', utvalgNavn)

  return (data ?? []).map((u: any) => ({
    utvalg: u.navn,
    medlemmer: u.lovutvalg_medlemmer ?? [],
  }))
}

export async function opprettLovutvalg(navn: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }

  const { data, error } = await supabase
    .from('lovutvalg')
    .insert({ navn: navn.trim(), organisasjon_id: bruker.organisasjon_id })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function slettLovutvalg(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle !== 'org-admin') return { success: false, error: 'Kun org-admin kan slette utvalg' }

  const { error } = await supabase.from('lovutvalg').delete().eq('id', id).eq('organisasjon_id', bruker.organisasjon_id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function leggTilMedlem(
  lovutvalgId: string,
  navn: string,
  epost: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('lovutvalg_medlemmer')
    .insert({ lovutvalg_id: lovutvalgId, navn: navn.trim(), epost: epost.trim().toLowerCase() })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function slettMedlem(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }

  const { data: medlem } = await supabase.from('lovutvalg_medlemmer').select('lovutvalg_id').eq('id', id).single()
  if (!medlem) return { success: false, error: 'Ikke funnet' }

  const { data: utvalg } = await supabase.from('lovutvalg').select('id').eq('id', medlem.lovutvalg_id).eq('organisasjon_id', bruker.organisasjon_id).single()
  if (!utvalg) return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase.from('lovutvalg_medlemmer').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function sendHoringTilUtvalgMedlemmer(params: {
  horingId: string
  mottakere: { navn: string; epost: string }[]
}): Promise<{ success: boolean; sendt: number; feilet: number; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const avsender = await hentBrukerOgOrg() as Awaited<ReturnType<typeof hentBrukerOgOrg>> & { epost: string; navn: string } | null
  if (!avsender) return { success: false, sendt: 0, feilet: 0, error: 'Ikke innlogget' }

  const { data: h } = await supabase
    .from('offentlige_horinger')
    .select('*')
    .eq('id', params.horingId)
    .single()
  if (!h) return { success: false, sendt: 0, feilet: 0, error: 'Høring ikke funnet' }

  const { sendHoringTilBehandlingEpost } = await import('@/lib/email')
  let sendt = 0, feilet = 0

  for (const mottaker of params.mottakere) {
    const res = await sendHoringTilBehandlingEpost({
      tilEpost: mottaker.epost,
      tilNavn: mottaker.navn,
      avsenderNavn: avsender.navn,
      avsenderEpost: avsender.epost,
      tittel: h.tittel,
      departement: h.departement ?? '',
      horingsfrist: h.horingsfrist,
      internFrist: h.intern_frist,
      utvalg: h.utvalg ?? [],
      regjeringenUrl: h.regjeringen_url,
      vedlegg: (h.vedlegg ?? []) as { tittel: string; url: string; type: string }[],
    })
    if (res.success) sendt++
    else feilet++
  }

  return { success: true, sendt, feilet }
}

export async function genererHoringEpostHtml(horingId: string): Promise<{ html: string; subject: string; avsenderNavn: string; avsenderEpost: string } | null> {
  const supabase = await createServerSupabaseClient()
  const avsender = await hentBrukerOgOrg() as any
  if (!avsender) return null

  const { data: h } = await supabase
    .from('offentlige_horinger')
    .select('*')
    .eq('id', horingId)
    .single()
  if (!h) return null

  const { byggHoringEpostHtml } = await import('@/lib/email')
  const result = byggHoringEpostHtml({
    avsenderNavn: avsender.navn,
    avsenderEpost: avsender.epost,
    tittel: h.tittel,
    departement: h.departement ?? '',
    horingsfrist: h.horingsfrist,
    internFrist: h.intern_frist,
    utvalg: h.utvalg ?? [],
    hovedUtvalg: h.hoved_utvalg,
    regjeringenUrl: h.regjeringen_url,
    vedlegg: (h.vedlegg ?? []) as { tittel: string; url: string; type: string }[],
  })
  return { ...result, avsenderNavn: avsender.navn, avsenderEpost: avsender.epost }
}

export async function sendHoringEpostTilMedlemmer(params: {
  mottakere: { navn: string; epost: string }[]
  subject: string
  html: string
}): Promise<{ success: boolean; sendt: number; feilet: number; error?: string }> {
  if (params.mottakere.length === 0) return { success: false, sendt: 0, feilet: 0, error: 'Ingen mottakere valgt' }
  const { sendEpostRaw } = await import('@/lib/email')
  let sendt = 0, feilet = 0
  for (const m of params.mottakere) {
    const res = await sendEpostRaw({ to: m.epost, subject: params.subject, html: params.html })
    if (res.success) sendt++
    else feilet++
  }
  return { success: true, sendt, feilet }
}

// ============================================================
// Organisasjonsovervåking (Brreg)
// ============================================================

export async function hentOvervakedeOrganisasjoner() {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('overvakede_organisasjoner')
    .select(`
      *,
      brreg_roller_snapshot(roller, hentet_dato),
      brukere!created_by(navn)
    `)
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('navn')

  return data ?? []
}

export async function hentBrregEndringer(grense = 50) {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('brreg_endringer')
    .select('*')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .order('oppdaget_dato', { ascending: false })
    .limit(grense)

  return data ?? []
}

export async function leggTilOvervaketOrganisasjon(orgnr: string) {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const renset = orgnr.replace(/\s/g, '')
  if (!/^\d{9}$/.test(renset)) return { success: false, error: 'Organisasjonsnummer må være 9 siffer' }

  const resp = await fetch(`${BRREG_BASE}/enheter/${renset}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!resp.ok) {
    if (resp.status === 404) return { success: false, error: 'Organisasjonsnummer ikke funnet i Brreg' }
    return { success: false, error: `Brreg-oppslag feilet (HTTP ${resp.status})` }
  }

  const enhet = await resp.json()
  const navn = enhet.navn ?? `Org ${renset}`

  const supabase = await createServerSupabaseClient()
  const { data: nyOrg, error } = await supabase
    .from('overvakede_organisasjoner')
    .insert({
      organisasjon_id: bruker.organisasjon_id,
      orgnr: renset,
      navn,
      created_by: bruker.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Organisasjonen overvåkes allerede' }
    return { success: false, error: error.message }
  }

  try {
    const rolleResp = await fetch(`${BRREG_BASE}/enheter/${renset}/roller`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (rolleResp.ok) {
      const rolleData = await rolleResp.json()
      const roller = normaliserRoller(rolleData.rollegrupper ?? [])

      await supabase.from('brreg_roller_snapshot').insert({
        overvaket_org_id: nyOrg.id,
        organisasjon_id: bruker.organisasjon_id,
        roller,
      })
    }
  } catch {
    // Initial snapshot populated on next cron run
  }

  return { success: true, navn }
}

export async function bulkLeggTilOrganisasjoner(orgnumre: string[]) {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget', resultater: [] }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang', resultater: [] }

  const resultater: { orgnr: string; navn: string | null; ok: boolean; feil?: string }[] = []

  for (const raa of orgnumre) {
    const orgnr = raa.replace(/\s/g, '')
    if (!/^\d{9}$/.test(orgnr)) {
      resultater.push({ orgnr, navn: null, ok: false, feil: 'Ugyldig format' })
      continue
    }

    try {
      const resp = await fetch(`${BRREG_BASE}/enheter/${orgnr}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })

      if (!resp.ok) {
        resultater.push({ orgnr, navn: null, ok: false, feil: resp.status === 404 ? 'Ikke funnet' : `HTTP ${resp.status}` })
        continue
      }

      const enhet = await resp.json()
      const navn = enhet.navn ?? `Org ${orgnr}`

      const supabase = await createServerSupabaseClient()
      const { data: nyOrg, error } = await supabase
        .from('overvakede_organisasjoner')
        .insert({
          organisasjon_id: bruker.organisasjon_id,
          orgnr,
          navn,
          created_by: bruker.id,
        })
        .select('id')
        .single()

      if (error) {
        resultater.push({ orgnr, navn, ok: false, feil: error.code === '23505' ? 'Finnes allerede' : error.message })
        continue
      }

      try {
        const rolleResp = await fetch(`${BRREG_BASE}/enheter/${orgnr}/roller`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        })
        if (rolleResp.ok) {
          const rolleData = await rolleResp.json()
          const roller = normaliserRoller(rolleData.rollegrupper ?? [])
          await supabase.from('brreg_roller_snapshot').insert({
            overvaket_org_id: nyOrg.id,
            organisasjon_id: bruker.organisasjon_id,
            roller,
          })
        }
      } catch { /* snapshot on next cron */ }

      resultater.push({ orgnr, navn, ok: true })
    } catch (err) {
      resultater.push({ orgnr, navn: null, ok: false, feil: err instanceof Error ? err.message : 'Ukjent feil' })
    }
  }

  return { success: true, resultater }
}

export async function fjernOvervaketOrganisasjon(id: string) {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle !== 'org-admin') return { success: false, error: 'Kun org-admin kan fjerne organisasjoner' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('overvakede_organisasjoner')
    .delete()
    .eq('id', id)
    .eq('organisasjon_id', bruker.organisasjon_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
