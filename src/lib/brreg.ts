export const BRREG_BASE = 'https://data.brreg.no/enhetsregisteret/api'

export interface BrregRolleType {
  kode: string
  beskrivelse: string
}

export interface BrregPerson {
  fornavn: string
  etternavn: string
  fodselsdato?: string
}

export interface BrregRolle {
  type: BrregRolleType
  person?: BrregPerson
  fratraadt: boolean
  rekpistrertDato?: string
}

export interface BrregRollegruppe {
  type: BrregRolleType
  roller: BrregRolle[]
}

export interface NormalisertRolle {
  rollegruppe: string
  rolletype: string
  personnavn: string
  fratraadt: boolean
}

export function normaliserRoller(rollegrupper: BrregRollegruppe[]): NormalisertRolle[] {
  const result: NormalisertRolle[] = []
  for (const gruppe of rollegrupper) {
    if (!gruppe.roller) continue
    for (const rolle of gruppe.roller) {
      if (rolle.person) {
        result.push({
          rollegruppe: gruppe.type.beskrivelse,
          rolletype: rolle.type.beskrivelse,
          personnavn: `${rolle.person.fornavn} ${rolle.person.etternavn}`,
          fratraadt: rolle.fratraadt,
        })
      }
    }
  }
  return result
}

function rolleNokkel(rolle: NormalisertRolle): string {
  return `${rolle.rolletype}|${rolle.personnavn}`
}

export interface DetektertEndring {
  endring_type: 'ny_rolle' | 'fjernet_rolle' | 'endring'
  rolle_type: string
  person_navn: string
  beskrivelse: string
}

export function finnEndringer(
  gamleRoller: NormalisertRolle[],
  nyeRoller: NormalisertRolle[],
  orgNavn: string
): DetektertEndring[] {
  const endringer: DetektertEndring[] = []

  const gamleAktive = new Map(
    gamleRoller.filter(r => !r.fratraadt).map(r => [rolleNokkel(r), r])
  )
  const nyeAktive = new Map(
    nyeRoller.filter(r => !r.fratraadt).map(r => [rolleNokkel(r), r])
  )

  for (const [key, rolle] of nyeAktive) {
    if (!gamleAktive.has(key)) {
      endringer.push({
        endring_type: 'ny_rolle',
        rolle_type: rolle.rolletype,
        person_navn: rolle.personnavn,
        beskrivelse: `${rolle.personnavn} er ny ${rolle.rolletype.toLowerCase()} i ${orgNavn}`,
      })
    }
  }

  for (const [key, rolle] of gamleAktive) {
    if (!nyeAktive.has(key)) {
      endringer.push({
        endring_type: 'fjernet_rolle',
        rolle_type: rolle.rolletype,
        person_navn: rolle.personnavn,
        beskrivelse: `${rolle.personnavn} er ikke lenger ${rolle.rolletype.toLowerCase()} i ${orgNavn}`,
      })
    }
  }

  return endringer
}
