export type KRType = 'gjennomslag' | 'tall' | 'milepael'
export type GjennomslagVerdi = 'ukjent' | 'ikke' | 'delvis' | 'fullt'
export type MaalUtfall = 'oppnadd' | 'delvis' | 'ikke' | 'avbrutt'
export type KildeType = 'innstilling' | 'proposisjon' | 'vedtak' | 'stortingsdebatt' | 'horingssvar' | 'motereferat' | 'media'
export type GjennomslagVurdering = 'bidrar' | 'delvis' | 'fullt' | 'ikke'
export type PKStatus = 'pagar' | 'avsluttet' | 'forkastet'
export type PKFase = 'dagsorden' | 'gjennomgang' | 'oppsummering'
export type StatusoppdateringStatus = 'venter' | 'bekreftet' | 'forkastet'

export type KRStatusLabel = 'Oppnådd' | 'På sporet' | 'Usikker' | 'I risiko' | 'Venter'
export type MaalStatusLabel = 'Oppnådd' | 'På sporet' | 'Usikker' | 'I risiko' | 'Venter' | 'Mangler nøkkelresultater'

export interface Tema {
  id: string
  organisasjon_id: string
  navn: string
  rekkefolge: number
  created_at: string
  updated_at: string
}

export interface Maal {
  id: string
  organisasjon_id: string
  tema_id: string
  tittel: string
  formulering: string | null
  status_tekst: string | null
  siste_kommentar: string | null
  arkivert: boolean
  arkivert_dato: string | null
  utfall: MaalUtfall | null
  oppsummering: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Nokkelresultat {
  id: string
  organisasjon_id: string
  maal_id: string
  tekst: string
  type: KRType
  verdi: string | null
  tall_naa: number | null
  tall_maal: number | null
  gjennomslag: GjennomslagVerdi | null
  oppnadd: boolean
  sannsynlighet: number
  frist_tekst: string | null
  rekkefolge: number
  sist_endret_tekst: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KRVurdering {
  id: string
  organisasjon_id: string
  nokkelresultat_id: string
  politisk_kvarter_id: string
  sannsynlighet: number
  forrige_sannsynlighet: number | null
  kommentar: string | null
  dato: string
  created_at: string
}

export interface Statusoppdatering {
  id: string
  organisasjon_id: string
  maal_id: string
  av_bruker_id: string | null
  kommentar: string | null
  data: StatusoppdateringData | null
  status: StatusoppdateringStatus
  created_at: string
  updated_at: string
}

export interface StatusoppdateringData {
  sannsynlighet?: Record<string, number>
  tiltak_status?: Record<string, 'gjort' | 'utsett' | 'dropp'>
  nye_tiltak?: Record<string, { tekst: string; ansvarlig_id: string | null; frist: string }[]>
}

export interface PolitiskKvarter {
  id: string
  organisasjon_id: string
  dato: string
  uke: number
  status: PKStatus
  fase: PKFase
  ordstyrer_id: string | null
  aktivt_maal_id: string | null
  oppsummering: PKOppsummering | null
  created_at: string
  updated_at: string
}

export interface PKOppsummering {
  antall_behandlet: number
  antall_hoppet_over: number
  forfalte_tiltak_gjort: number
  forfalte_tiltak_totalt: number
  nye_tiltak: number
  utsatte_tiltak: number
  fall_i_sannsynlighet: number
}

export interface PolitiskKvarterMaal {
  id: string
  politisk_kvarter_id: string
  maal_id: string
  rekkefolge: number
  valgt: boolean
  behandlet: boolean
  kommentar: string | null
  utkast: StatusoppdateringData | null
  sist_endret_av: string | null
  created_at: string
  updated_at: string
}

export interface MaalKobling {
  id: string
  organisasjon_id: string
  maal_id: string
  sak_id: string | null
  offentlig_horing_id: string | null
  created_at: string
}

export interface Gjennomslag {
  id: string
  organisasjon_id: string
  maal_id: string
  nokkelresultat_id: string | null
  dato: string
  kilde_type: KildeType
  tekst: string
  vurdering: GjennomslagVurdering
  url: string | null
  created_by: string | null
  created_at: string
}

export interface MaalMedDetaljer extends Maal {
  tema?: Tema
  nokkelresultater: NokkelresultatMedTiltak[]
  gjennomslag: Gjennomslag[]
  lenker: { id: string; tittel: string; url: string; type: string; created_at: string }[]
  koblinger: (MaalKobling & {
    saker?: { id: string; tittel: string; landing: string | null; komite_dato: string | null; stortings_dato: string | null; horingsfrist: string | null } | null
    offentlige_horinger?: { id: string; tittel: string; horingsfrist: string | null } | null
  })[]
  ventende_oppdatering?: Statusoppdatering | null
}

export interface NokkelresultatMedTiltak extends Nokkelresultat {
  tiltak: TiltakAktivitet[]
  vurderinger?: KRVurdering[]
}

export interface TiltakAktivitet {
  id: string
  nokkelresultat_id: string | null
  sak_id: string | null
  organisasjon_id: string
  beskrivelse: string
  ansvarlig_id: string | null
  frist: string | null
  status: 'planlagt' | 'utført' | 'avlyst'
  type: string
  lukket_dato: string | null
  updated_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  brukere?: { navn: string } | null
}
