import type { Nokkelresultat, Maal, TiltakAktivitet, NokkelresultatMedTiltak, MaalMedDetaljer } from './pavirkning-types'
import type { KRStatusLabel, MaalStatusLabel } from './pavirkning-types'

// 5.1 Status på nøkkelresultat
export function krStatus(kr: Nokkelresultat): KRStatusLabel {
  if (kr.oppnadd) return 'Oppnådd'
  if (kr.type === 'gjennomslag' && kr.gjennomslag === 'ikke') return 'I risiko'
  if (kr.type === 'gjennomslag' && kr.gjennomslag === 'ukjent') return 'Venter'
  if (kr.sannsynlighet >= 7) return 'På sporet'
  if (kr.sannsynlighet >= 4) return 'Usikker'
  return 'I risiko'
}

// 5.2 Status på mål
export function maalStatus(nokkelresultater: Nokkelresultat[]): MaalStatusLabel {
  if (nokkelresultater.length === 0) return 'Mangler nøkkelresultater'
  if (nokkelresultater.every(kr => kr.oppnadd)) return 'Oppnådd'

  const aapne = nokkelresultater.filter(kr => !kr.oppnadd)
  const statuser = aapne.map(kr => krStatus(kr))
  if (statuser.every(s => s === 'Venter')) return 'Venter'

  const snitt = Math.round(aapne.reduce((sum, kr) => sum + kr.sannsynlighet, 0) / aapne.length)
  if (snitt >= 7) return 'På sporet'
  if (snitt >= 4) return 'Usikker'
  return 'I risiko'
}

// 5.3 Visningsverdi for nøkkelresultat
export function krVerdi(kr: Nokkelresultat): string {
  if (kr.type === 'gjennomslag') {
    const labels: Record<string, string> = { ukjent: 'Ukjent', ikke: 'Ikke', delvis: 'Delvis', fullt: 'Fullt' }
    return labels[kr.gjennomslag ?? 'ukjent'] ?? 'Ukjent'
  }
  if (kr.type === 'tall') {
    if (kr.tall_naa != null && kr.tall_maal != null) {
      if (kr.oppnadd) return `Nådd (${kr.tall_naa})`
      return `${kr.tall_naa} av ${kr.tall_maal}`
    }
    return '–'
  }
  // milepael
  return kr.oppnadd ? 'Oppnådd' : 'Ikke oppnådd'
}

// 5.3 Tall-fremdrift (0–1)
export function tallFremdrift(kr: Nokkelresultat): number {
  if (kr.type !== 'tall' || kr.tall_maal == null || kr.tall_maal === 0) return 0
  return Math.min(1, Math.max(0, (kr.tall_naa ?? 0) / kr.tall_maal))
}

// 5.4 Tiltak forfaller
export function tiltakForfaller(tiltak: TiltakAktivitet): boolean {
  if (tiltak.status !== 'planlagt' || !tiltak.frist) return false
  const frist = new Date(tiltak.frist)
  const iDag = new Date()
  iDag.setHours(0, 0, 0, 0)
  const om7dager = new Date(iDag)
  om7dager.setDate(om7dager.getDate() + 7)
  return frist <= om7dager
}

export function tiltakPassertFrist(tiltak: TiltakAktivitet): boolean {
  if (!tiltak.frist) return false
  const frist = new Date(tiltak.frist)
  const iDag = new Date()
  iDag.setHours(0, 0, 0, 0)
  return frist < iDag
}

// 5.4 Utsett 1 uke
export function utsettFrist(gammelFrist: string | null): string {
  const iDag = new Date()
  iDag.setHours(0, 0, 0, 0)
  const base = gammelFrist ? new Date(Math.max(new Date(gammelFrist).getTime(), iDag.getTime())) : iDag
  base.setDate(base.getDate() + 7)
  return base.toISOString().slice(0, 10)
}

// Statusfarge
export function statusFarge(status: KRStatusLabel | MaalStatusLabel): string {
  switch (status) {
    case 'Oppnådd': return '#22c55e'
    case 'På sporet': return '#4A9EDB'
    case 'Usikker': return '#f59e0b'
    case 'I risiko': return '#BA0C2F'
    case 'Venter': return '#9ca3af'
    case 'Mangler nøkkelresultater': return '#9ca3af'
    default: return '#9ca3af'
  }
}

// 5.5 Ingen aktivitet: åpent KR uten åpne tiltak
export function ingenAktivitet(kr: NokkelresultatMedTiltak): boolean {
  if (kr.oppnadd) return false
  return !kr.tiltak.some(t => t.status === 'planlagt')
}

// 5.6 Forslag til dagsorden
export interface DagsordenForslag {
  maalId: string
  grunner: string[]
}

export function forslagTilDagsorden(
  maal: MaalMedDetaljer,
  sisteVurderinger?: Record<string, { sannsynlighet: number; forrige: number | null }>
): string[] {
  const grunner: string[] = []
  const iDag = new Date()
  const om30 = new Date(iDag)
  om30.setDate(om30.getDate() + 30)

  // Koblet sak/høring med frist innen 30 dager
  for (const k of maal.koblinger) {
    const datoer: { dato: string; tekst: string }[] = []
    if (k.saker?.komite_dato) datoer.push({ dato: k.saker.komite_dato, tekst: `Komitéhøring ${formaterDato(k.saker.komite_dato)}` })
    if (k.saker?.stortings_dato) datoer.push({ dato: k.saker.stortings_dato, tekst: `Stortingsbehandling ${formaterDato(k.saker.stortings_dato)}` })
    if (k.saker?.horingsfrist) datoer.push({ dato: k.saker.horingsfrist, tekst: `Høringsfrist ${formaterDato(k.saker.horingsfrist)}` })
    if (k.offentlige_horinger?.horingsfrist) datoer.push({ dato: k.offentlige_horinger.horingsfrist, tekst: `Høringsfrist ${formaterDato(k.offentlige_horinger.horingsfrist)}` })
    for (const d of datoer) {
      const dt = new Date(d.dato)
      if (dt >= iDag && dt <= om30) grunner.push(d.tekst)
    }
  }

  // Status I risiko
  const status = maalStatus(maal.nokkelresultater)
  if (status === 'I risiko') grunner.push('I risiko')

  // KR falt 2+ i sannsynlighet
  if (sisteVurderinger) {
    for (const kr of maal.nokkelresultater) {
      const v = sisteVurderinger[kr.id]
      if (v && v.forrige != null && v.sannsynlighet - v.forrige <= -2) {
        grunner.push('Fall i sannsynlighet')
        break
      }
    }
  }

  // Ventende statusoppdatering
  if (maal.ventende_oppdatering) grunner.push('Oppdatert siden sist')

  // Tiltak forfaller
  const harForfall = maal.nokkelresultater.some(kr =>
    kr.tiltak.some(t => tiltakForfaller(t))
  )
  if (harForfall) grunner.push('Tiltak forfaller')

  return grunner
}

function formaterDato(dato: string): string {
  const d = new Date(dato)
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })
}
