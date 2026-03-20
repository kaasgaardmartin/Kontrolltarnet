'use client'

import { useState } from 'react'
import type { Aktivitet, AktivitetType, AktivitetStatus, SakStakeholder } from '@/lib/types'
import { opprettAktivitet, oppdaterAktivitetStatus, oppdaterAktivitetAnsvarlig, slettAktivitet, oppdaterHoring } from '@/lib/actions'

interface Props {
  sakId: string
  aktiviteter: Aktivitet[]
  sakStakeholders: SakStakeholder[]
  brukere: { id: string; navn: string }[]
  komiteDato: string | null
  stortingsDato: string | null
  horingsfrist: string | null
  horingsnotatUrl: string | null
  horingssvarUrl: string | null
  onOppdatert: () => void
  kanRedigere: boolean
}

interface TidslinjeElement {
  id: string
  dato: string | null
  type: 'aktivitet' | 'milepæl'
  label: string
  beskrivelse?: string
  status?: string
  aktivitetType?: string
  ansvarlig?: string | null
  ansvarligId?: string | null
  stakeholderNavn?: string | null
  erForfalt: boolean
  erIdag: boolean
  erSnart: boolean
  dagerTil: number | null
  lenker?: { label: string; url: string }[]
}

type LeggTilModus = null | 'velg' | 'oppgave' | 'horing'

const TYPE_FARGE: Record<string, { bg: string; text: string; dot: string }> = {
  'møte': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  telefon: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  'e-post': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  'sosiale medier': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  publisering: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  annet: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
}

function beregnDager(dato: string | null): { dagerTil: number | null; erForfalt: boolean; erIdag: boolean; erSnart: boolean } {
  if (!dato) return { dagerTil: null, erForfalt: false, erIdag: false, erSnart: false }
  const d = new Date(dato)
  const idag = new Date()
  idag.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = d.getTime() - idag.getTime()
  const dager = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return {
    dagerTil: dager,
    erForfalt: dager < 0,
    erIdag: dager === 0,
    erSnart: dager > 0 && dager <= 3,
  }
}

function formaterDato(dato: string): string {
  return new Date(dato).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function fristTekst(dagerTil: number | null): string {
  if (dagerTil === null) return ''
  if (dagerTil < 0) return `${Math.abs(dagerTil)}d siden`
  if (dagerTil === 0) return 'i dag'
  if (dagerTil === 1) return 'i morgen'
  return `om ${dagerTil}d`
}

export default function TidslinjeSeksjon({
  sakId, aktiviteter, sakStakeholders, brukere, komiteDato, stortingsDato,
  horingsfrist, horingsnotatUrl, horingssvarUrl, onOppdatert, kanRedigere
}: Props) {
  // Legg til-state
  const [leggTilModus, setLeggTilModus] = useState<LeggTilModus>(null)
  const [lagrer, setLagrer] = useState(false)

  // Oppgave-skjema
  const [oppgType, setOppgType] = useState<AktivitetType>('annet')
  const [oppgBeskrivelse, setOppgBeskrivelse] = useState('')
  const [oppgFrist, setOppgFrist] = useState('')
  const [oppgStakeholderId, setOppgStakeholderId] = useState('')
  const [oppgAnsvarligId, setOppgAnsvarligId] = useState('')

  // Høring-skjema
  const [hFrist, setHFrist] = useState(horingsfrist ?? '')
  const [hNotatUrl, setHNotatUrl] = useState(horingsnotatUrl ?? '')
  const [hSvarUrl, setHSvarUrl] = useState(horingssvarUrl ?? '')

  function lukkSkjema() {
    setLeggTilModus(null)
    setOppgBeskrivelse('')
    setOppgFrist('')
    setOppgStakeholderId('')
    setOppgAnsvarligId('')
    setOppgType('annet')
  }

  async function handleLeggTilOppgave() {
    if (!oppgBeskrivelse.trim()) return
    setLagrer(true)
    await opprettAktivitet(sakId, {
      type: oppgType,
      beskrivelse: oppgBeskrivelse.trim(),
      frist: oppgFrist || null,
      stakeholder_id: oppgStakeholderId || null,
      ansvarlig_id: oppgAnsvarligId || null,
    })
    lukkSkjema()
    setLagrer(false)
    onOppdatert()
  }

  async function handleLagreHoring() {
    setLagrer(true)
    await oppdaterHoring(sakId, {
      horingsfrist: hFrist || null,
      horingsnotat_url: hNotatUrl.trim() || null,
      horingssvar_url: hSvarUrl.trim() || null,
    })
    setLeggTilModus(null)
    setLagrer(false)
    onOppdatert()
  }

  async function handleStatusEndring(aktivitetId: string, nyStatus: AktivitetStatus) {
    await oppdaterAktivitetStatus(aktivitetId, nyStatus)
    onOppdatert()
  }

  async function handleAnsvarligEndring(aktivitetId: string, nyAnsvarligId: string) {
    await oppdaterAktivitetAnsvarlig(aktivitetId, nyAnsvarligId || null)
    onOppdatert()
  }

  async function handleSlett(aktivitetId: string) {
    await slettAktivitet(aktivitetId)
    onOppdatert()
  }

  // Bygg tidslinje
  const elementer: TidslinjeElement[] = []

  if (komiteDato) {
    const info = beregnDager(komiteDato)
    elementer.push({ id: 'mp-komite', dato: komiteDato, type: 'milepæl', label: 'Komitédato', ...info })
  }
  if (stortingsDato) {
    const info = beregnDager(stortingsDato)
    elementer.push({ id: 'mp-storting', dato: stortingsDato, type: 'milepæl', label: 'Stortingsdato', ...info })
  }
  if (horingsfrist) {
    const info = beregnDager(horingsfrist)
    const lenker: { label: string; url: string }[] = []
    if (horingsnotatUrl) lenker.push({ label: 'Høringsnotat', url: horingsnotatUrl })
    if (horingssvarUrl) lenker.push({ label: 'Vårt høringssvar', url: horingssvarUrl })
    elementer.push({ id: 'mp-horing', dato: horingsfrist, type: 'milepæl', label: 'Høringsfrist', lenker, ...info })
  }

  const planlagte = aktiviteter.filter(a => a.status === 'planlagt')
  for (const a of planlagte) {
    const info = beregnDager(a.frist)
    elementer.push({
      id: a.id, dato: a.frist, type: 'aktivitet', label: a.type,
      beskrivelse: a.beskrivelse, status: a.status, aktivitetType: a.type,
      ansvarlig: a.brukere?.navn || null, ansvarligId: a.ansvarlig_id,
      stakeholderNavn: a.stakeholders?.navn || null, ...info,
    })
  }

  elementer.sort((a, b) => {
    if (a.dato === null && b.dato === null) return 0
    if (a.dato === null) return 1
    if (b.dato === null) return -1
    return new Date(a.dato).getTime() - new Date(b.dato).getTime()
  })

  const fullforte = aktiviteter.filter(a => a.status === 'utført')
  const avlyste = aktiviteter.filter(a => a.status === 'avlyst')
  const antallForfalt = elementer.filter(e => e.erForfalt && e.type === 'aktivitet').length
  const antallIdag = elementer.filter(e => e.erIdag).length
  const antallSnart = elementer.filter(e => e.erSnart).length
  const harHoring = !!horingsfrist

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0F1923]">
          Tidslinje & oppgaver
          {planlagte.length > 0 && (
            <span className="text-gray-400 font-normal ml-1">({planlagte.length} aktive)</span>
          )}
        </h3>
        {kanRedigere && leggTilModus === null && (
          <button
            onClick={() => setLeggTilModus('velg')}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] transition-colors"
          >
            + Legg til
          </button>
        )}
      </div>

      {/* Velg-type knapper */}
      {leggTilModus === 'velg' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setLeggTilModus('oppgave')}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#4A9EDB] hover:bg-[#4A9EDB]/5 transition-colors"
          >
            <svg className="w-4 h-4 text-[#4A9EDB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div className="text-left">
              <div className="text-xs font-medium text-[#0F1923]">Oppgave</div>
              <div className="text-xs text-gray-400">Møte, telefon, e-post, etc.</div>
            </div>
          </button>
          <button
            onClick={() => {
              setHFrist(horingsfrist ?? '')
              setHNotatUrl(horingsnotatUrl ?? '')
              setHSvarUrl(horingssvarUrl ?? '')
              setLeggTilModus('horing')
            }}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#4A9EDB] hover:bg-[#4A9EDB]/5 transition-colors"
          >
            <svg className="w-4 h-4 text-[#4A9EDB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <div className="text-left">
              <div className="text-xs font-medium text-[#0F1923]">{harHoring ? 'Rediger høring' : 'Høring'}</div>
              <div className="text-xs text-gray-400">Frist, notat og svar</div>
            </div>
          </button>
          <button
            onClick={() => setLeggTilModus(null)}
            className="px-2 text-gray-400 hover:text-gray-600"
            title="Avbryt"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Oppgave-skjema */}
      {leggTilModus === 'oppgave' && (
        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-[#4A9EDB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-xs font-semibold text-[#0F1923]">Ny oppgave</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
              <select
                value={oppgType}
                onChange={e => setOppgType(e.target.value as AktivitetType)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
              >
                <option value="møte">Møte</option>
                <option value="telefon">Telefon</option>
                <option value="e-post">E-post</option>
                <option value="sosiale medier">Sosiale medier</option>
                <option value="publisering">Publisering</option>
                <option value="annet">Annet</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Frist</label>
              <input
                type="date"
                value={oppgFrist}
                onChange={e => setOppgFrist(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Beskrivelse *</label>
            <input
              type="text"
              value={oppgBeskrivelse}
              onChange={e => setOppgBeskrivelse(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              placeholder="Hva skal gjøres?"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            {sakStakeholders.length > 0 && (
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Stakeholder</label>
                <select
                  value={oppgStakeholderId}
                  onChange={e => setOppgStakeholderId(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                >
                  <option value="">Ingen</option>
                  {sakStakeholders.map(ss => (
                    <option key={ss.stakeholder_id} value={ss.stakeholder_id}>
                      {ss.stakeholders?.navn}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ansvarlig</label>
              <select
                value={oppgAnsvarligId}
                onChange={e => setOppgAnsvarligId(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
              >
                <option value="">Ingen</option>
                {brukere.map(b => (
                  <option key={b.id} value={b.id}>{b.navn}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLeggTilOppgave}
              disabled={lagrer || !oppgBeskrivelse.trim()}
              className="text-xs px-3 py-1.5 bg-[#4A9EDB] text-white rounded hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              {lagrer ? 'Legger til...' : 'Legg til'}
            </button>
            <button onClick={lukkSkjema} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Høring-skjema */}
      {leggTilModus === 'horing' && (
        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-[#4A9EDB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <span className="text-xs font-semibold text-[#0F1923]">{harHoring ? 'Rediger høring' : 'Ny høring'}</span>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Høringsfrist</label>
            <input
              type="date"
              value={hFrist}
              onChange={e => setHFrist(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Lenke til høringsnotat</label>
            <input
              type="url"
              value={hNotatUrl}
              onChange={e => setHNotatUrl(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              placeholder="https://www.regjeringen.no/..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Lenke til vårt høringssvar</label>
            <input
              type="url"
              value={hSvarUrl}
              onChange={e => setHSvarUrl(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLagreHoring}
              disabled={lagrer}
              className="text-xs px-3 py-1.5 bg-[#4A9EDB] text-white rounded hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              {lagrer ? 'Lagrer...' : 'Lagre'}
            </button>
            {harHoring && (
              <button
                onClick={async () => {
                  setLagrer(true)
                  await oppdaterHoring(sakId, { horingsfrist: null, horingsnotat_url: null, horingssvar_url: null })
                  setLeggTilModus(null)
                  setLagrer(false)
                  onOppdatert()
                }}
                disabled={lagrer}
                className="text-xs px-3 py-1.5 text-red-500 hover:text-red-700"
              >
                Fjern høring
              </button>
            )}
            <button onClick={() => setLeggTilModus(null)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Oppsummering-badges */}
      {(antallForfalt > 0 || antallIdag > 0 || antallSnart > 0) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {antallForfalt > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-700">{antallForfalt} forfalt</span>
            </div>
          )}
          {antallIdag > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-xs font-medium text-orange-700">{antallIdag} i dag</span>
            </div>
          )}
          {antallSnart > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-amber-700">{antallSnart} snart</span>
            </div>
          )}
        </div>
      )}

      {/* Tidslinje */}
      {elementer.length > 0 ? (
        <div className="relative">
          <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-gray-200" />
          <div className="space-y-0.5">
            {elementer.map(el => {
              const erMilepæl = el.type === 'milepæl'
              const typeFarge = el.aktivitetType ? (TYPE_FARGE[el.aktivitetType] || TYPE_FARGE.annet) : null

              let dotFarge = 'bg-gray-300'
              if (el.erForfalt) dotFarge = 'bg-red-500'
              else if (el.erIdag) dotFarge = 'bg-orange-500'
              else if (el.erSnart) dotFarge = 'bg-amber-400'
              else if (erMilepæl) dotFarge = 'bg-[#4A9EDB]'
              else if (typeFarge) dotFarge = typeFarge.dot

              return (
                <div key={el.id} className="relative flex items-start gap-3">
                  {/* Dot */}
                  <div className="relative z-10 mt-2 shrink-0 w-[15px] h-[15px] flex items-center justify-center">
                    {erMilepæl ? (
                      <div className={`w-3 h-3 rotate-45 ${dotFarge} border-2 border-white shadow-sm`} />
                    ) : (
                      <div className={`w-2.5 h-2.5 rounded-full ${dotFarge} border-2 border-white shadow-sm`} />
                    )}
                  </div>

                  {/* Innhold */}
                  <div className="flex-1 pb-2">
                    {erMilepæl ? (
                      <div className={`px-3 py-2 rounded-lg border ${
                        el.erForfalt ? 'bg-gray-50 border-gray-200' :
                        el.erIdag ? 'bg-orange-50 border-orange-200' :
                        el.erSnart ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50/50 border-blue-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <svg className={`w-3.5 h-3.5 shrink-0 ${
                            el.erForfalt ? 'text-gray-400' : el.erIdag ? 'text-orange-500' : 'text-[#4A9EDB]'
                          }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                          </svg>
                          <span className="text-xs font-semibold text-[#0F1923] flex-1">{el.label}</span>
                          {el.dato && <span className="text-xs text-gray-500">{formaterDato(el.dato)}</span>}
                          {el.dagerTil !== null && (
                            <span className={`text-xs font-medium ${
                              el.erForfalt ? 'text-gray-400' : el.erIdag ? 'text-orange-600' : el.erSnart ? 'text-amber-600' : 'text-[#4A9EDB]'
                            }`}>{fristTekst(el.dagerTil)}</span>
                          )}
                          {/* Rediger høring-knapp */}
                          {el.id === 'mp-horing' && kanRedigere && (
                            <button
                              onClick={() => {
                                setHFrist(horingsfrist ?? '')
                                setHNotatUrl(horingsnotatUrl ?? '')
                                setHSvarUrl(horingssvarUrl ?? '')
                                setLeggTilModus('horing')
                              }}
                              className="text-xs text-gray-400 hover:text-[#4A9EDB] transition-colors"
                              title="Rediger høring"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {el.lenker && el.lenker.length > 0 && (
                          <div className="flex gap-3 mt-1.5 ml-5.5">
                            {el.lenker.map(lenke => (
                              <a
                                key={lenke.label}
                                href={lenke.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#4A9EDB] hover:underline"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.28" />
                                </svg>
                                {lenke.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`group px-3 py-2 rounded-lg border transition-colors ${
                        el.erForfalt ? 'bg-red-50/40 border-red-200' :
                        el.erIdag ? 'bg-orange-50/40 border-orange-200' :
                        el.erSnart ? 'bg-amber-50/30 border-amber-100' :
                        'bg-white border-gray-100 hover:border-gray-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {kanRedigere && (
                            <button
                              onClick={() => handleStatusEndring(el.id, 'utført')}
                              className="mt-0.5 w-4 h-4 rounded border border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 shrink-0 transition-colors"
                              title="Merk som utført"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {typeFarge && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${typeFarge.bg} ${typeFarge.text}`}>{el.label}</span>
                              )}
                              {el.stakeholderNavn && <span className="text-xs text-gray-400">→ {el.stakeholderNavn}</span>}
                              {el.dato ? (
                                <span className={`text-xs ml-auto ${
                                  el.erForfalt ? 'text-red-600 font-medium' : el.erIdag ? 'text-orange-600 font-medium' : el.erSnart ? 'text-amber-600' : 'text-gray-400'
                                }`}>{formaterDato(el.dato)} ({fristTekst(el.dagerTil)})</span>
                              ) : (
                                <span className="text-xs text-gray-300 italic ml-auto">Ingen frist</span>
                              )}
                            </div>
                            <p className="text-sm text-[#0F1923] mt-0.5">{el.beskrivelse}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {kanRedigere ? (
                                <select
                                  value={el.ansvarligId || ''}
                                  onChange={e => handleAnsvarligEndring(el.id, e.target.value)}
                                  className="text-xs px-1 py-0.5 border border-transparent hover:border-gray-200 rounded bg-transparent cursor-pointer text-gray-400 hover:text-gray-600"
                                >
                                  <option value="">Ikke tildelt</option>
                                  {brukere.map(b => (
                                    <option key={b.id} value={b.id}>{b.navn}</option>
                                  ))}
                                </select>
                              ) : (
                                el.ansvarlig && <span className="text-xs text-gray-400">{el.ansvarlig}</span>
                              )}
                            </div>
                          </div>
                          {kanRedigere && (
                            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                              <button onClick={() => handleStatusEndring(el.id, 'avlyst')} className="text-xs text-gray-400 hover:text-amber-600" title="Avlys">Avlys</button>
                              <button onClick={() => handleSlett(el.id)} className="text-xs text-gray-400 hover:text-red-500" title="Slett">Slett</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        leggTilModus === null && (
          <p className="text-xs text-gray-400">Ingen oppgaver eller frister ennå.</p>
        )
      )}

      {/* Fullførte / avlyste */}
      {(fullforte.length > 0 || avlyste.length > 0) && (
        <details className="mt-3 pt-3 border-t border-gray-100">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {fullforte.length + avlyste.length} fullførte/avlyste
          </summary>
          <div className="space-y-1 mt-2">
            {[...fullforte, ...avlyste].map(a => {
              const tf = TYPE_FARGE[a.type] || TYPE_FARGE.annet
              const erAvlyst = a.status === 'avlyst'
              return (
                <div key={a.id} className="group flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 transition-colors">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${erAvlyst ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    {erAvlyst ? 'avlyst' : 'utført'}
                  </span>
                  <span className={`text-xs px-1 rounded ${tf.bg} ${tf.text}`}>{a.type}</span>
                  <span className={`text-xs flex-1 ${erAvlyst ? 'line-through text-gray-400' : 'text-gray-600'}`}>{a.beskrivelse}</span>
                  {kanRedigere && (
                    <button
                      onClick={() => handleStatusEndring(a.id, 'planlagt')}
                      className="hidden group-hover:inline text-xs text-gray-400 hover:text-[#4A9EDB] shrink-0"
                      title="Sett tilbake til planlagt"
                    >Angre</button>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
