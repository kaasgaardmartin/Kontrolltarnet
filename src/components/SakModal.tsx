'use client'

import { useState, useEffect } from 'react'
import { PARTIER, type Stemme, type Niva, type Landing } from '@/lib/types'
import { opprettSak, oppdaterSak, slettSak, type SakFormData, type SakMedStemmer } from '@/lib/actions'
import type { StortingetSak } from '@/app/api/stortinget/route'

interface Komite {
  id: string
  navn: string
}

interface ForelderData {
  stortingssak_ref?: string | null
  komite_id?: string | null
  komite_dato?: string | null
  stortings_dato?: string | null
  niva?: string | null
  sesjon?: string | null
}

interface Props {
  sak: SakMedStemmer | null  // null = ny sak
  komiteer: Komite[]
  forelderId?: string | null  // for creating delsak
  forelderData?: ForelderData | null  // parent data for pre-filling
  importertStortingetSak?: StortingetSak | null  // data fra Stortinget-import
  onLagret: () => void
  onLukk: () => void
}

const NIVA_OPTIONS: { value: Niva; label: string }[] = [
  { value: 'storting', label: 'Storting' },
  { value: 'departement', label: 'Departement' },
  { value: 'intern', label: 'Intern' },
]

const LANDING_OPTIONS: { value: Landing; label: string }[] = [
  { value: 'ukjent', label: 'Ukjent' },
  { value: 'vedtas', label: 'Vedtas' },
  { value: 'faller', label: 'Faller' },
  { value: 'usikkert', label: 'Usikkert' },
  { value: 'vedtatt', label: 'Vedtatt' },
]

const STEMME_OPTIONS: { value: Stemme; label: string; bg: string; activeBg: string; activeText: string }[] = [
  { value: 'for', label: 'For', bg: 'hover:bg-emerald-50', activeBg: 'bg-emerald-100', activeText: 'text-emerald-700' },
  { value: 'mot', label: 'Mot', bg: 'hover:bg-red-50', activeBg: 'bg-red-100', activeText: 'text-red-700' },
  { value: 'ukjent', label: 'Ukjent', bg: 'hover:bg-gray-50', activeBg: 'bg-gray-100', activeText: 'text-gray-500' },
]

function getStemmeForParti(sak: SakMedStemmer | null, parti: string): Stemme {
  if (!sak) return 'ukjent'
  const found = sak.partistemmer.find(s => s.parti === parti)
  return (found?.stemme as Stemme) || 'ukjent'
}

export default function SakModal({ sak, komiteer, forelderId, forelderData, importertStortingetSak, onLagret, onLukk }: Props) {
  const erNy = !sak
  const fd = forelderData // shorthand for parent defaults
  const imp = importertStortingetSak // shorthand for import data

  // Finn komité-ID basert på Stortinget-import (match på navn)
  const importKomiteId = imp?.komite
    ? komiteer.find(k => k.navn.toLowerCase().includes(imp.komite!.toLowerCase()))?.id ?? ''
    : ''

  const [tittel, setTittel] = useState(sak?.tittel ?? imp?.korttittel ?? imp?.tittel ?? '')
  const [beskrivelse, setBeskrivelse] = useState(sak?.beskrivelse ?? (imp ? imp.tittel : '') ?? '')
  const [niva, setNiva] = useState<Niva | ''>(sak?.niva ?? (fd?.niva as Niva) ?? (imp ? 'storting' : ''))
  const [landing, setLanding] = useState<Landing>(sak?.landing ?? 'ukjent')
  const [komiteId, setKomiteId] = useState(sak?.komite_id ?? fd?.komite_id ?? importKomiteId)
  const [stortingssakRef, setStortingssakRef] = useState(
    sak?.stortingssak_ref ?? fd?.stortingssak_ref ?? (imp ? `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${imp.id}` : '')
  )
  const [sesjon, setSesjon] = useState(sak?.sesjon ?? fd?.sesjon ?? '')
  const [komiteDato, setKomiteDato] = useState(sak?.komite_dato ?? fd?.komite_dato ?? imp?.innstilling_dato ?? '')
  const [stortingsDato, setStortingsDato] = useState(sak?.stortings_dato ?? fd?.stortings_dato ?? imp?.behandling_dato ?? '')
  const [stemmer, setStemmer] = useState<Record<string, Stemme>>(() => {
    const initial: Record<string, Stemme> = {}
    for (const p of PARTIER) {
      initial[p] = getStemmeForParti(sak, p)
    }
    return initial
  })
  const [lagrer, setLagrer] = useState(false)
  const [sletter, setSletter] = useState(false)
  const [feil, setFeil] = useState('')
  const [bekreftSlett, setBekreftSlett] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onLukk()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onLukk])

  async function handleLagre() {
    if (!tittel.trim()) {
      setFeil('Tittel er påkrevd')
      return
    }

    setLagrer(true)
    setFeil('')

    const formData: SakFormData = {
      tittel: tittel.trim(),
      beskrivelse: beskrivelse.trim() || null,
      niva: niva || null,
      landing: landing,
      komite_id: komiteId || null,
      stortingssak_ref: stortingssakRef.trim() || null,
      sesjon: sesjon.trim() || null,
      komite_dato: komiteDato || null,
      stortings_dato: stortingsDato || null,
      forelder_id: forelderId || null,
      stemmer: PARTIER.map(p => ({ parti: p, stemme: stemmer[p] })),
    }

    const result = erNy
      ? await opprettSak(formData)
      : await oppdaterSak(sak!.id, formData)

    setLagrer(false)

    if (result.success) {
      onLagret()
    } else {
      setFeil(result.error || 'Noe gikk galt')
    }
  }

  async function handleSlett() {
    if (!sak) return
    setSletter(true)
    const result = await slettSak(sak.id)
    setSletter(false)
    if (result.success) {
      onLagret()
    } else {
      setFeil(result.error || 'Kunne ikke slette')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onLukk} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-[#0F1923]">
            {erNy ? (forelderId ? 'Ny delsak' : 'Ny sak') : 'Rediger sak'}
          </h2>
          <button onClick={onLukk} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Stortinget-import banner */}
          {imp && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#BA0C2F]/5 border border-[#BA0C2F]/20 rounded-lg">
              <svg className="w-4 h-4 text-[#BA0C2F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21" />
              </svg>
              <span className="text-xs text-[#BA0C2F]">
                Importert fra Stortinget — sak #{imp.id}
                {imp.henvisning && ` (${imp.henvisning})`}
              </span>
            </div>
          )}

          {/* Tittel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tittel *</label>
            <input
              type="text"
              value={tittel}
              onChange={e => setTittel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
              placeholder="Navn på saken"
              autoFocus
            />
          </div>

          {/* Beskrivelse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
            <textarea
              value={beskrivelse}
              onChange={e => setBeskrivelse(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent resize-none"
              placeholder="Kort beskrivelse av saken"
            />
          </div>

          {/* Nivå + Landing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nivå</label>
              <select
                value={niva}
                onChange={e => setNiva(e.target.value as Niva | '')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent bg-white"
              >
                <option value="">Velg nivå</option>
                {NIVA_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Landing</label>
              <select
                value={landing}
                onChange={e => setLanding(e.target.value as Landing)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent bg-white"
              >
                {LANDING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Komité + Stortingsref */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Komité</label>
              <select
                value={komiteId}
                onChange={e => setKomiteId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent bg-white"
              >
                <option value="">Ingen komité</option>
                {komiteer.map(k => (
                  <option key={k.id} value={k.id}>{k.navn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stortingsreferanse (lenke)</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.28" />
                </svg>
                <input
                  type="url"
                  value={stortingssakRef}
                  onChange={e => setStortingssakRef(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  placeholder="https://www.stortinget.no/..."
                />
              </div>
            </div>
          </div>

          {/* Sesjon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stortingssesjon</label>
            <input
              type="text"
              value={sesjon}
              onChange={e => setSesjon(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
              placeholder="F.eks. 2025-2026"
            />
          </div>

          {/* Datoer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Komitédato</label>
              <input
                type="date"
                value={komiteDato}
                onChange={e => setKomiteDato(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stortingsdato</label>
              <input
                type="date"
                value={stortingsDato}
                onChange={e => setStortingsDato(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
              />
            </div>
          </div>

          {/* Partistemmer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Partistemmer</label>
            <div className="space-y-2">
              {PARTIER.map(parti => (
                <div key={parti} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-10">{parti}</span>
                  <div className="flex gap-1">
                    {STEMME_OPTIONS.map(opt => {
                      const erAktiv = stemmer[parti] === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStemmer(prev => ({ ...prev, [parti]: opt.value }))}
                          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                            erAktiv
                              ? `${opt.activeBg} ${opt.activeText} border-transparent font-medium`
                              : `bg-white border-gray-200 text-gray-500 ${opt.bg}`
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {feil && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {feil}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between rounded-b-xl">
          <div>
            {!erNy && !bekreftSlett && (
              <button
                type="button"
                onClick={() => setBekreftSlett(true)}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Slett sak
              </button>
            )}
            {!erNy && bekreftSlett && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Er du sikker?</span>
                <button
                  type="button"
                  onClick={handleSlett}
                  disabled={sletter}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {sletter ? 'Sletter...' : 'Ja, slett'}
                </button>
                <button
                  type="button"
                  onClick={() => setBekreftSlett(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLukk}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleLagre}
              disabled={lagrer}
              className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
            >
              {lagrer ? 'Lagrer...' : erNy ? 'Opprett sak' : 'Lagre endringer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
