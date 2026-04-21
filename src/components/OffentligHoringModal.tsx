'use client'

import { useState, useEffect } from 'react'
import type { OffentligHoring, OffentligHoringStatus, HoringType, OffentligHoringVedlegg } from '@/lib/actions'
import { opprettOffentligHoring, oppdaterOffentligHoring, slettOffentligHoring } from '@/lib/actions'
import type { HoringScrapeResultat } from '@/app/api/horing-scrape/route'

interface BrukerMinimal {
  id: string
  navn: string
  aktiv?: boolean
}

// ---- Konstanter ----

export const UTVALG_LISTE = [
  'Arbeidsrett',
  'Asyl- og utlendingsrett',
  'Avgiftsrett',
  'Bank finansiering og valuta',
  'Barne- og familierett arv og skifte',
  'Barnevern',
  'Bygningsrett og reguleringsspørsmål',
  'Børs- og verdipapirhandelrett',
  'Demokrati- og konstitusjonsspørsmål',
  'Eiendomsmegling',
  'Energirett vannkraft olje og gass',
  'Erstatningsrett',
  'Fangst fiskeri og havbruk',
  'Fast eiendom (tings- og leierett)',
  'Forsikringsrett',
  'Forvaltningsrett',
  'IKT og personvern',
  'Immaterial- og markedsføringsrett',
  'Konkurranserett',
  'Konkurs akkord panterett tvangsfullbyrdelse og inkasso',
  'Miljø klima og bærekraft',
  'Reindrifts- og samerett',
  'Samferdsel og sjø- luft- og annen transportrett inklusive sjøforsikring',
  'Selskapsrett',
  'Sivilprosess og voldgift',
  'Skatterett',
  'Skjønns- ekspropriasjons- og vassdragsrett',
  'Strafferett og straffeprosess',
  'Velferds- og trygderett',
] as const

const STATUS_LABEL: Record<OffentligHoringStatus, string> = {
  innkommet: 'Innkommet',
  til_vurdering: 'Til vurdering',
  svarer: 'Svarer',
  svarer_ikke: 'Svarer ikke',
  levert: 'Levert',
}

const STATUS_STEG: OffentligHoringStatus[] = ['innkommet', 'til_vurdering', 'svarer', 'levert']

// ---- Props ----

interface Props {
  horing: OffentligHoring | null   // null = ny høring
  brukere: BrukerMinimal[]
  onLagret: () => void
  onLukk: () => void
}

// ---- Hjelpefunksjoner ----

function formatDato(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return d }
}

// ---- Komponent ----

export default function OffentligHoringModal({ horing, brukere, onLagret, onLukk }: Props) {
  const erNy = horing === null

  // URL-henting
  const [url, setUrl] = useState(horing?.regjeringen_url || '')
  const [henterUrl, setHenterUrl] = useState(false)
  const [urlFeil, setUrlFeil] = useState('')
  const [urlHentet, setUrlHentet] = useState(false)

  // Felt
  const [tittel, setTittel] = useState(horing?.tittel || '')
  const [departement, setDepartement] = useState(horing?.departement || '')
  const [referanse, setReferanse] = useState(horing?.referanse || '')
  const [publisertDato, setPublisertDato] = useState(horing?.publisert_dato || '')
  const [horingsfrist, setHoringsfrist] = useState(horing?.horingsfrist || '')
  const [horingType, setHoringType] = useState<HoringType | ''>(horing?.horing_type || '')
  const [beskrivelse, setBeskrivelse] = useState(horing?.beskrivelse || '')
  const [horingInstanser, setHoringInstanser] = useState<string[]>(horing?.horing_instanser || [])
  const [vedlegg, setVedlegg] = useState<OffentligHoringVedlegg[]>(horing?.vedlegg || [])

  // Intern behandling
  const [status, setStatus] = useState<OffentligHoringStatus>(horing?.status || 'innkommet')
  const [utvalg, setUtvalg] = useState<string[]>(horing?.utvalg || [])
  const [ansvarligId, setAnsvarligId] = useState(horing?.ansvarlig_id || '')
  const [internFrist, setInternFrist] = useState(horing?.intern_frist || '')
  const [internNotat, setInternNotat] = useState(horing?.intern_notat || '')

  // UI-state
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')
  const [sletter, setSletter] = useState(false)
  const [bekreftSlett, setBekreftSlett] = useState(false)
  const [fane, setFane] = useState<'info' | 'intern'>('info')
  const [utvalgSok, setUtvalgSok] = useState('')

  // Auto-hent fra URL
  async function hentFraUrl() {
    if (!url || !url.includes('regjeringen.no')) {
      setUrlFeil('URL-en må være fra regjeringen.no')
      return
    }
    setHenterUrl(true)
    setUrlFeil('')
    try {
      const resp = await fetch('/api/horing-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setUrlFeil(data.error || 'Kunne ikke hente data')
        return
      }
      const res = data as HoringScrapeResultat
      if (res.tittel) setTittel(res.tittel)
      if (res.departement) setDepartement(res.departement)
      if (res.referanse) setReferanse(res.referanse)
      if (res.publisert_dato) setPublisertDato(res.publisert_dato)
      if (res.horingsfrist) setHoringsfrist(res.horingsfrist)
      if (res.horing_type) setHoringType(res.horing_type)
      if (res.beskrivelse) setBeskrivelse(res.beskrivelse)
      if (res.horing_instanser?.length) setHoringInstanser(res.horing_instanser)
      if (res.vedlegg?.length) setVedlegg(res.vedlegg)
      setUrlHentet(true)
    } catch {
      setUrlFeil('Nettverksfeil — prøv igjen')
    } finally {
      setHenterUrl(false)
    }
  }

  function toggleUtvalg(u: string) {
    setUtvalg(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])
  }

  async function handleLagre() {
    if (!tittel.trim()) { setFeil('Tittel er påkrevd'); return }
    setLagrer(true)
    setFeil('')
    const input = {
      tittel: tittel.trim(),
      departement: departement || null,
      regjeringen_url: url || null,
      referanse: referanse || null,
      publisert_dato: publisertDato || null,
      horingsfrist: horingsfrist || null,
      horing_type: horingType || null,
      beskrivelse: beskrivelse || null,
      horing_instanser: horingInstanser,
      vedlegg,
      status,
      utvalg,
      ansvarlig_id: ansvarligId || null,
      intern_frist: internFrist || null,
      intern_notat: internNotat || null,
    }
    const res = erNy
      ? await opprettOffentligHoring(input)
      : await oppdaterOffentligHoring(horing!.id, input)
    if (!res.success) { setFeil(res.error || 'Feil ved lagring'); setLagrer(false); return }
    onLagret()
  }

  async function handleSlett() {
    if (!bekreftSlett) { setBekreftSlett(true); return }
    setSletter(true)
    await slettOffentligHoring(horing!.id)
    onLagret()
  }

  const filtrertUtvalg = UTVALG_LISTE.filter(u =>
    !utvalgSok || u.toLowerCase().includes(utvalgSok.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-[#0F1923]">
            {erNy ? 'Legg til høring' : 'Rediger høring'}
          </h2>
          <button onClick={onLukk} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Faner */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {(['info', 'intern'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFane(f)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                fane === f
                  ? 'border-[#4A9EDB] text-[#4A9EDB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'info' ? 'Informasjon' : 'Intern behandling'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {fane === 'info' && (
            <>
              {/* URL-henting */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  regjeringen.no URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setUrlFeil(''); setUrlHentet(false) }}
                    placeholder="https://www.regjeringen.no/no/dokumenter/horing-.../id.../"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  />
                  <button
                    onClick={hentFraUrl}
                    disabled={henterUrl || !url}
                    className="px-3 py-2 text-sm bg-[#0F1923] text-white rounded-lg hover:bg-[#1a2836] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {henterUrl ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    )}
                    {henterUrl ? 'Henter...' : 'Hent'}
                  </button>
                </div>
                {urlFeil && <p className="text-xs text-red-500 mt-1">{urlFeil}</p>}
                {urlHentet && <p className="text-xs text-emerald-600 mt-1">✓ Data hentet automatisk — kontroller feltene under</p>}
              </div>

              {/* Tittel */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Tittel <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={tittel}
                  onChange={e => setTittel(e.target.value)}
                  placeholder="Høring – ..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                />
              </div>

              {/* Departement + Referanse */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Departement / avsender
                  </label>
                  <input
                    type="text"
                    value={departement}
                    onChange={e => setDepartement(e.target.value)}
                    placeholder="f.eks. Finansdepartementet"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Saksnummer
                  </label>
                  <input
                    type="text"
                    value={referanse}
                    onChange={e => setReferanse(e.target.value)}
                    placeholder="f.eks. 26/787"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Datoer + type */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Publisert
                  </label>
                  <input
                    type="date"
                    value={publisertDato}
                    onChange={e => setPublisertDato(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Høringsfrist
                  </label>
                  <input
                    type="date"
                    value={horingsfrist}
                    onChange={e => setHoringsfrist(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Type
                  </label>
                  <select
                    value={horingType}
                    onChange={e => setHoringType(e.target.value as HoringType | '')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  >
                    <option value="">Ukjent</option>
                    <option value="skriftlig">Skriftlig</option>
                    <option value="muntlig">Muntlig</option>
                    <option value="begge">Begge</option>
                  </select>
                </div>
              </div>

              {/* Beskrivelse */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Beskrivelse
                </label>
                <textarea
                  value={beskrivelse}
                  onChange={e => setBeskrivelse(e.target.value)}
                  rows={3}
                  placeholder="Kort sammendrag av hva høringen gjelder..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent resize-none"
                />
              </div>

              {/* Vedlegg (PDF-lenker) */}
              {vedlegg.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Vedlegg
                  </label>
                  <div className="space-y-1.5">
                    {vedlegg.map((v, i) => (
                      <a
                        key={i}
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-colors group text-sm"
                      >
                        <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 4h5v7h7v9H6V4z"/>
                          <path d="M8.5 14.5h7v1h-7zm0 2.5h5v1h-5z" opacity=".5"/>
                        </svg>
                        <span className="flex-1 text-gray-700 group-hover:text-blue-700 truncate">{v.tittel}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                          v.type === 'horingsbrev'
                            ? 'bg-blue-100 text-blue-700'
                            : v.type === 'horingsnotat'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {v.type === 'horingsbrev' ? 'Høringsbrev' : v.type === 'horingsnotat' ? 'Høringsnotat' : 'Vedlegg'}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Høringsinstanser */}
              {horingInstanser.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Høringsinstanser ({horingInstanser.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                    {horingInstanser.map(inst => (
                      <span key={inst} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {fane === 'intern' && (
            <>
              {/* Status-steg */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Status
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['innkommet', 'til_vurdering', 'svarer', 'svarer_ikke', 'levert'] as OffentligHoringStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        status === s
                          ? 'bg-[#0F1923] text-white border-[#0F1923]'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tildel utvalg */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Tildelt utvalg {utvalg.length > 0 && <span className="text-[#4A9EDB] font-normal">({utvalg.length} valgt)</span>}
                </label>

                {/* Valgte utvalg */}
                {utvalg.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {utvalg.map(u => (
                      <span
                        key={u}
                        className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-full"
                      >
                        {u}
                        <button
                          onClick={() => toggleUtvalg(u)}
                          className="hover:text-indigo-900 transition-colors ml-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Søk + liste */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <input
                      type="text"
                      value={utvalgSok}
                      onChange={e => setUtvalgSok(e.target.value)}
                      placeholder="Søk etter utvalg..."
                      className="w-full text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {filtrertUtvalg.map(u => (
                      <button
                        key={u}
                        onClick={() => toggleUtvalg(u)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          utvalg.includes(u)
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {u}
                        {utvalg.includes(u) && (
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ansvarlig + intern frist */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Ansvarlig
                  </label>
                  <select
                    value={ansvarligId}
                    onChange={e => setAnsvarligId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  >
                    <option value="">Ikke tildelt</option>
                    {brukere.filter(b => b.aktiv !== false).map(b => (
                      <option key={b.id} value={b.id}>{b.navn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Intern frist
                  </label>
                  <input
                    type="date"
                    value={internFrist}
                    onChange={e => setInternFrist(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Internt notat */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Internt notat
                </label>
                <textarea
                  value={internNotat}
                  onChange={e => setInternNotat(e.target.value)}
                  rows={4}
                  placeholder="Interne vurderinger, begrunnelse for beslutning, kontaktpersoner..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent resize-none"
                />
              </div>
            </>
          )}

          {feil && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{feil}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <div>
            {!erNy && (
              bekreftSlett ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Er du sikker?</span>
                  <button
                    onClick={handleSlett}
                    disabled={sletter}
                    className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {sletter ? 'Sletter...' : 'Ja, slett'}
                  </button>
                  <button
                    onClick={() => setBekreftSlett(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Avbryt
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setBekreftSlett(true)}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  Slett høring
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLukk}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleLagre}
              disabled={lagrer || !tittel.trim()}
              className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {lagrer ? 'Lagrer...' : erNy ? 'Legg til' : 'Lagre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
