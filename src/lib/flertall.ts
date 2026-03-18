/**
 * Flertallsberegning (majority calculation)
 *
 * Beregner om det er flertall for eller mot en sak basert på
 * registrerte partistemmer og mandatfordeling.
 */

export interface PartiStemme {
  parti: string
  stemme: 'for' | 'mot' | 'ukjent'
}

export interface Mandatfordeling {
  parti: string
  antall: number
}

export interface FlertallsResultat {
  forMandater: number
  motMandater: number
  ukjentMandater: number
  totaltMandater: number
  harFlertall: 'for' | 'mot' | 'uklart'
  prosentFor: number
  prosentMot: number
}

export function beregnFlertall(
  stemmer: PartiStemme[],
  mandater: Mandatfordeling[]
): FlertallsResultat {
  const mandatMap = new Map(mandater.map((m) => [m.parti, m.antall]))
  const totaltMandater = mandater.reduce((sum, m) => sum + m.antall, 0)

  let forMandater = 0
  let motMandater = 0
  let ukjentMandater = 0

  for (const stemme of stemmer) {
    const antall = mandatMap.get(stemme.parti) ?? 0
    switch (stemme.stemme) {
      case 'for':
        forMandater += antall
        break
      case 'mot':
        motMandater += antall
        break
      case 'ukjent':
      default:
        ukjentMandater += antall
        break
    }
  }

  // Add mandates for parties without registered votes as ukjent
  const registrertPartier = new Set(stemmer.map((s) => s.parti))
  for (const m of mandater) {
    if (!registrertPartier.has(m.parti)) {
      ukjentMandater += m.antall
    }
  }

  const flertallsgrense = Math.floor(totaltMandater / 2) + 1

  let harFlertall: 'for' | 'mot' | 'uklart' = 'uklart'
  if (forMandater >= flertallsgrense) {
    harFlertall = 'for'
  } else if (motMandater >= flertallsgrense) {
    harFlertall = 'mot'
  }

  return {
    forMandater,
    motMandater,
    ukjentMandater,
    totaltMandater,
    harFlertall,
    prosentFor: totaltMandater > 0 ? (forMandater / totaltMandater) * 100 : 0,
    prosentMot: totaltMandater > 0 ? (motMandater / totaltMandater) * 100 : 0,
  }
}

/**
 * Sjekk for omvendt flertall: komiteen og salen peker i ulik retning
 */
export function harOmvendtFlertall(
  komiteResultat: FlertallsResultat,
  salResultat: FlertallsResultat
): boolean {
  if (komiteResultat.harFlertall === 'uklart' || salResultat.harFlertall === 'uklart') {
    return false
  }
  return komiteResultat.harFlertall !== salResultat.harFlertall
}
