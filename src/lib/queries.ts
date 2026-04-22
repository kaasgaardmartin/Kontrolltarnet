'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  hentSakerMedStemmer,
  hentStortingsmandater,
  hentKomiteer,
  hentKommendeAktiviteter,
  hentSak,
  hentKomiteMandater,
  hentOrgBrukere,
  hentSakAbonnement,
  hentArkiverteSaker,
  hentMineAktiviteter,
  hentKomiteerMedMandater,
  hentAntallUlesteVarsler,
  hentHoringer,
  hentOffentligeHoringer,
  hentArkiverteHoringer,
  hentOffentligHoring,
} from './actions'

// ============================================================
// Query keys — sentralisert for enkel invalidering
// ============================================================

export const queryKeys = {
  saker: ['saker'] as const,
  arkiverteSaker: ['arkiverteSaker'] as const,
  mandater: ['stortingsmandater'] as const,
  komiteer: ['komiteer'] as const,
  komiteerMedMandater: ['komiteerMedMandater'] as const,
  kommendeAktiviteter: ['kommendeAktiviteter'] as const,
  mineAktiviteter: ['mineAktiviteter'] as const,
  orgBrukere: ['orgBrukere'] as const,
  ulesteVarsler: ['ulesteVarsler'] as const,
  sak: (id: string) => ['sak', id] as const,
  komiteMandater: (komiteId: string) => ['komiteMandater', komiteId] as const,
  sakAbonnement: (sakId: string) => ['sakAbonnement', sakId] as const,
  horinger: (sakId: string) => ['horinger', sakId] as const,
  offentligeHoringer: ['offentligeHoringer'] as const,
  arkiverteHoringer: ['arkiverteHoringer'] as const,
  offentligHoring: (id: string) => ['offentligHoring', id] as const,
}

// ============================================================
// Hooks — erstatter useEffect + useState-mønsteret
// ============================================================

/** Alle aktive saker med stemmer */
export function useSaker() {
  return useQuery({
    queryKey: queryKeys.saker,
    queryFn: hentSakerMedStemmer,
  })
}

/** Stortingsmandater — sjelden endring, lang staleTime */
export function useMandater() {
  return useQuery({
    queryKey: queryKeys.mandater,
    queryFn: hentStortingsmandater,
    staleTime: 5 * 60 * 1000,
  })
}

/** Komitéliste — sjelden endring */
export function useKomiteer() {
  return useQuery({
    queryKey: queryKeys.komiteer,
    queryFn: hentKomiteer,
    staleTime: 5 * 60 * 1000,
  })
}

/** Kommende aktiviteter for forsiden */
export function useKommendeAktiviteter() {
  return useQuery({
    queryKey: queryKeys.kommendeAktiviteter,
    queryFn: hentKommendeAktiviteter,
  })
}

/** En enkelt sak med detaljer */
export function useSak(sakId: string) {
  return useQuery({
    queryKey: queryKeys.sak(sakId),
    queryFn: () => hentSak(sakId),
  })
}

/** Høringer for en sak */
export function useHoringer(sakId: string) {
  return useQuery({
    queryKey: queryKeys.horinger(sakId),
    queryFn: () => hentHoringer(sakId),
  })
}

/** Komitemandater for en gitt komité */
export function useKomiteMandater(komiteId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.komiteMandater(komiteId ?? ''),
    queryFn: () => hentKomiteMandater(komiteId!),
    enabled: !!komiteId,
    staleTime: 5 * 60 * 1000,
  })
}

/** Brukere i organisasjonen */
export function useOrgBrukere() {
  return useQuery({
    queryKey: queryKeys.orgBrukere,
    queryFn: hentOrgBrukere,
    staleTime: 5 * 60 * 1000,
  })
}

/** Abonnement på sak */
export function useSakAbonnement(sakId: string) {
  return useQuery({
    queryKey: queryKeys.sakAbonnement(sakId),
    queryFn: () => hentSakAbonnement(sakId),
  })
}

/** Arkiverte saker */
export function useArkiverteSaker() {
  return useQuery({
    queryKey: queryKeys.arkiverteSaker,
    queryFn: hentArkiverteSaker,
  })
}

/** Mine aktiviteter */
export function useMineAktiviteter() {
  return useQuery({
    queryKey: queryKeys.mineAktiviteter,
    queryFn: hentMineAktiviteter,
  })
}

/** Komiteer med mandater (admin) */
export function useKomiteerMedMandater() {
  return useQuery({
    queryKey: queryKeys.komiteerMedMandater,
    queryFn: hentKomiteerMedMandater,
  })
}

/** Antall uleste varsler */
export function useUlesteVarsler() {
  return useQuery({
    queryKey: queryKeys.ulesteVarsler,
    queryFn: hentAntallUlesteVarsler,
    staleTime: 30 * 1000, // Oppdater oftere — 30 sek
  })
}

/** Alle offentlige høringer (ekskl. arkiverte) */
export function useOffentligeHoringer() {
  return useQuery({
    queryKey: queryKeys.offentligeHoringer,
    queryFn: hentOffentligeHoringer,
  })
}

/** Arkiverte offentlige høringer */
export function useArkiverteHoringer() {
  return useQuery({
    queryKey: queryKeys.arkiverteHoringer,
    queryFn: hentArkiverteHoringer,
  })
}

/** En enkelt offentlig høring */
export function useOffentligHoring(id: string) {
  return useQuery({
    queryKey: queryKeys.offentligHoring(id),
    queryFn: () => hentOffentligHoring(id),
    enabled: !!id,
  })
}

// ============================================================
// Invaliderings-helper
// ============================================================

/** Hook som returnerer en funksjon for å invalidere relevante queries etter mutasjoner */
export function useInvaliderSakData() {
  const queryClient = useQueryClient()

  return {
    /** Invalider alt saksrelatert (etter opprett/rediger/slett sak) */
    invaliderSaker: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saker })
      queryClient.invalidateQueries({ queryKey: queryKeys.arkiverteSaker })
      queryClient.invalidateQueries({ queryKey: queryKeys.kommendeAktiviteter })
      queryClient.invalidateQueries({ queryKey: queryKeys.mineAktiviteter })
    },
    /** Invalider en enkelt sak (etter notat, lenke, stakeholder, aktivitet-endring) */
    invaliderSak: (sakId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sak(sakId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.kommendeAktiviteter })
      queryClient.invalidateQueries({ queryKey: queryKeys.mineAktiviteter })
    },
    /** Invalider varsler */
    invaliderVarsler: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ulesteVarsler })
    },
    /** Invalider admin-data (mandater, komiteer) */
    invaliderAdmin: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mandater })
      queryClient.invalidateQueries({ queryKey: queryKeys.komiteer })
      queryClient.invalidateQueries({ queryKey: queryKeys.komiteerMedMandater })
    },
    /** Invalider offentlige høringer */
    invaliderOffentligeHoringer: (id?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offentligeHoringer })
      queryClient.invalidateQueries({ queryKey: queryKeys.arkiverteHoringer })
      if (id) queryClient.invalidateQueries({ queryKey: queryKeys.offentligHoring(id) })
    },
  }
}
