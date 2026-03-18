'use server'

import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from './supabase-server'
import type { Sak, PartiStemme, Stemme, Niva, Landing, Notat, Lenke, LenkeType, Komite, KomiteMandat, Rolle, Bruker, Stakeholder, SakStakeholder, Aktivitet, StakeholderType, Holdning, Innflytelse, AktivitetType, AktivitetStatus, Varsel, VarselType } from './types'

export interface SakMedStemmer extends Sak {
  partistemmer: PartiStemme[]
  delsaker?: SakMedStemmer[]
  stakeholder_navn?: string[]
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
  stemmer: { parti: string; stemme: Stemme }[]
}

export async function hentBrukerOgOrg() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bruker } = await supabase
    .from('brukere')
    .select('id, organisasjon_id, rolle')
    .eq('id', user.id)
    .single()

  return bruker
}

export async function hentSakerMedStemmer(): Promise<SakMedStemmer[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  // Fetch all non-archived saker with their votes and stakeholder names
  const { data: alleSaker } = await supabase
    .from('saker')
    .select('*, partistemmer(*), sak_stakeholders(stakeholders(navn))')
    .eq('organisasjon_id', bruker.organisasjon_id)
    .eq('arkivert', false)
    .order('updated_at', { ascending: false })

  const saker = (alleSaker ?? []).map((s: Record<string, unknown>) => {
    const sakStakeholders = (s.sak_stakeholders ?? []) as { stakeholders: { navn: string } | null }[]
    const stakeholder_navn = sakStakeholders
      .map(ss => ss.stakeholders?.navn)
      .filter((n): n is string => !!n)
    const { sak_stakeholders: _ss, ...rest } = s
    return { ...rest, stakeholder_navn } as SakMedStemmer
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
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const cachedFetch = unstable_cache(
    async (orgId: string) => {
      const supabase = await createServerSupabaseClient()
      const { data } = await supabase
        .from('stortingssalen_mandater')
        .select('parti, antall')
        .eq('organisasjon_id', orgId)
      return data ?? []
    },
    ['stortingsmandater'],
    { revalidate: 3600 } // cache 1 time
  )

  return cachedFetch(bruker.organisasjon_id)
}

export async function hentKomiteMandater(komiteId: string) {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const cachedFetch = unstable_cache(
    async (kId: string) => {
      const supabase = await createServerSupabaseClient()
      const { data } = await supabase
        .from('komite_mandater')
        .select('parti, antall')
        .eq('komite_id', kId)
      return data ?? []
    },
    ['komitemandater', komiteId],
    { revalidate: 3600 }
  )

  return cachedFetch(komiteId)
}

export async function hentKomiteer() {
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const cachedFetch = unstable_cache(
    async (orgId: string) => {
      const supabase = await createServerSupabaseClient()
      const { data } = await supabase
        .from('komiteer')
        .select('id, navn')
        .eq('organisasjon_id', orgId)
        .order('navn')
      return data ?? []
    },
    ['komiteer'],
    { revalidate: 3600 }
  )

  return cachedFetch(bruker.organisasjon_id)
}

export async function opprettSak(formData: SakFormData): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

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

  return { success: true }
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

export async function slettSak(sakId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('saker')
    .delete()
    .eq('id', sakId)

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

  const { error } = await supabase.from('lenker').delete().eq('id', lenkeId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function arkiverSak(sakId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle === 'leser') return { success: false, error: 'Ingen tilgang' }

  const { error } = await supabase
    .from('saker')
    .update({ arkivert: true, arkivert_dato: new Date().toISOString() })
    .eq('id', sakId)

  if (error) return { success: false, error: error.message }
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

  return (data ?? []) as SakMedStemmer[]
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

  const { error } = await supabase.from('komiteer').update({ navn }).eq('id', komiteId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function slettKomite(komiteId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return { success: false, error: 'Ikke innlogget' }
  if (bruker.rolle !== 'org-admin') return { success: false, error: 'Kun org-admin kan slette komiteer' }

  const { error } = await supabase.from('komiteer').delete().eq('id', komiteId)
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

  const { error } = await supabase.from('sak_stakeholders').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
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

  const { error } = await supabase.from('aktiviteter').insert({
    sak_id: sakId,
    organisasjon_id: bruker.organisasjon_id,
    type: aktivitetData.type,
    beskrivelse: aktivitetData.beskrivelse,
    frist: aktivitetData.frist || null,
    stakeholder_id: aktivitetData.stakeholder_id || null,
    ansvarlig_id: aktivitetData.ansvarlig_id || null,
    created_by: bruker.id,
  })

  if (error) return { success: false, error: error.message }

  await opprettVarsler(sakId, 'aktivitet', `Ny aktivitet: ${aktivitetData.beskrivelse}`, bruker.id)

  // Notify assigned user directly
  if (aktivitetData.ansvarlig_id && aktivitetData.ansvarlig_id !== bruker.id) {
    const supabase2 = await createServerSupabaseClient()
    await supabase2.from('varsler').insert({
      bruker_id: aktivitetData.ansvarlig_id,
      sak_id: sakId,
      type: 'tildelt' as const,
      melding: `Du er tildelt en oppgave: ${aktivitetData.beskrivelse}`,
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
    await opprettVarsler(aktivitet.sak_id, 'aktivitet', `Aktivitet ${statusLabel}: ${aktivitet.beskrivelse}`, bruker.id)
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

  const { error } = await supabase.from('aktiviteter').delete().eq('id', aktivitetId)
  if (error) return { success: false, error: error.message }
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

export async function hentOrgBrukere(): Promise<{ id: string; navn: string }[]> {
  const supabase = await createServerSupabaseClient()
  const bruker = await hentBrukerOgOrg()
  if (!bruker) return []

  const { data } = await supabase
    .from('brukere')
    .select('id, navn')
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
    .eq('ansvarlig_id', bruker.id)
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
  ekskluderBrukerId: string
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
