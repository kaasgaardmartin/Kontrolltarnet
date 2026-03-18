export type Rolle = 'leser' | 'redaktør' | 'org-admin'
export type Niva = 'storting' | 'departement' | 'intern'
export type Landing = 'vedtas' | 'faller' | 'usikkert' | 'ukjent' | 'vedtatt'
export type Utfall = 'vedtatt' | 'ikke_vedtatt' | null
export type Stemme = 'for' | 'mot' | 'ukjent'
export type LenkeType = 'offisiell' | 'eget dokument' | 'media' | 'sosiale medier'
export type StakeholderType = 'organisasjon' | 'politiker' | 'enkeltperson' | 'media' | 'annet'
export type Holdning = 'for' | 'mot' | 'nøytral' | 'ukjent'
export type Innflytelse = 'høy' | 'middels' | 'lav'
export type AktivitetType = 'møte' | 'telefon' | 'e-post' | 'sosiale medier' | 'publisering' | 'annet'
export type AktivitetStatus = 'planlagt' | 'utført' | 'avlyst'
export type VarselType = 'notat' | 'landing' | 'utfall' | 'aktivitet' | 'frist' | 'tildelt'

export const PARTIER = ['Ap', 'H', 'FrP', 'SV', 'SP', 'V', 'KrF', 'MDG', 'R'] as const
export type Parti = (typeof PARTIER)[number]

export interface Organisasjon {
  id: string
  navn: string
  domene: string | null
  logo_url: string | null
  created_at: string
}

export interface Bruker {
  id: string
  organisasjon_id: string
  navn: string
  epost: string
  rolle: Rolle
  aktiv: boolean
  created_at: string
}

export interface Sak {
  id: string
  organisasjon_id: string
  tittel: string
  beskrivelse: string | null
  niva: Niva | null
  status: string | null
  landing: Landing | null
  komite_id: string | null
  stortingssak_ref: string | null
  behandles_av: string | null
  eier_id: string | null
  komite_dato: string | null
  stortings_dato: string | null
  utfall: 'vedtatt' | 'ikke_vedtatt' | null
  utfall_dato: string | null
  arkivert: boolean
  arkivert_dato: string | null
  forelder_id: string | null
  sesjon: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartiStemme {
  id: string
  sak_id: string
  organisasjon_id: string
  parti: string
  stemme: Stemme
  updated_by: string | null
  updated_at: string
}

export interface Komite {
  id: string
  organisasjon_id: string
  navn: string
  totalt_antall: number | null
  created_at: string
}

export interface KomiteMandat {
  id: string
  komite_id: string
  parti: string
  antall: number
}

export interface StortingssalenMandat {
  id: string
  organisasjon_id: string
  parti: string
  antall: number
}

export interface Notat {
  id: string
  sak_id: string
  organisasjon_id: string
  tekst: string
  forfatter_id: string | null
  created_at: string
}

export interface Lenke {
  id: string
  sak_id: string
  organisasjon_id: string
  tittel: string
  url: string
  type: LenkeType
  lagt_til_av: string | null
  created_at: string
}

export interface Stakeholder {
  id: string
  organisasjon_id: string
  navn: string
  type: StakeholderType
  kontaktinfo: string | null
  created_by: string | null
  created_at: string
}

export interface SakStakeholder {
  id: string
  sak_id: string
  stakeholder_id: string
  organisasjon_id: string
  holdning: Holdning
  innflytelse: Innflytelse
  notat: string | null
  created_at: string
  stakeholders?: Stakeholder
}

export interface Aktivitet {
  id: string
  sak_id: string
  organisasjon_id: string
  stakeholder_id: string | null
  type: AktivitetType
  beskrivelse: string
  ansvarlig_id: string | null
  frist: string | null
  status: AktivitetStatus
  created_by: string | null
  created_at: string
  updated_at: string
  stakeholders?: Stakeholder | null
  brukere?: { navn: string } | null
}

export interface Varsel {
  id: string
  bruker_id: string
  sak_id: string | null
  type: VarselType
  melding: string
  lest: boolean
  created_at: string
  saker?: { tittel: string } | null
}

export interface VarselInnstilling {
  id: string
  bruker_id: string
  sak_id: string
  aktiv: boolean
}
