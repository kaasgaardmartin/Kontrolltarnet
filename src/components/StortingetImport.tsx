'use client'

import { useState, useCallback } from 'react'
import type { StortingetSak } from '@/app/api/stortinget/route'

interface Props {
  onImporter: (sak: StortingetSak) => void
  onLukk: () => void
}

const SESJONER = [
  '2025-2026',
  '2024-2025',
  '2023-2024',
  '2022-2023',
  '2021-2022',
]

const STATUS_FARGE: Record<string, string> = {
  'behandlet': 'bg-emerald-100 text-emerald-700',
  'til_behandling': 'bg-blue-100 text-blue-700',
  'mottatt': 'bg-yellow-100 text-yellow-700',
  'varslet': 'bg-gray-100 text-gray-600',
  'trukket': 'bg-red-100 text-red-700',
  'bortfalt': 'bg-gray-100 text-gray-400',
}

const TYPE_LABEL: Record<string, string> = {
  'lovsak': 'Lovsak',
  'alminneligsak': 'Alminnelig sak',
  'budsjett': 'Budsjett',
  'interpellasjon': 'Interpellasjon',
  'stortingsmelding': 'Stortingsmelding',
}

export default function StortingetImport({ onImporter, onLukk }: Props) {
  const [sesjon, setSesjon] = useState('2024-2025')
  const [sok, setSok] = useState('')
  const [sokInput, setSokInput] = useState('')
  const [saker, setSaker] = useState<StortingetSak[]>([])
  const [antall, setAntall] = useState(0)
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState('')
  const [harSokt, setHarSokt] = useState(false)

  const hentSaker = useCallback(async (sesjonId: string, sokTekst: string) => {
    if (!sokTekst.trim()) return

    setLaster(true)
    setFeil('')
    setHarSokt(true)

    try {
      const params = new URLSearchParams({ sesjon: sesjonId, sok: sokTekst.trim() })
      const res = await fetch(`/api/stortinget?${params}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Feil ${res.status}`)
      }

      const data = await res.json()
      setSaker(data.saker)
      setAntall(data.antall)
    } catch (err) {
      setFeil(err instanceof Error ? err.message : 'Ukjent feil')
      setSaker([])
    } finally {
      setLaster(false)
    }
  }, [])

  function handleSok(e: React.FormEvent) {
    e.preventDefault()
    setSok(sokInput)
    hentSaker(sesjon, sokInput)
  }

  function handleSesjonEndring(nySesjon: string) {
    setSesjon(nySesjon)
    if (sok.trim()) {
      hentSaker(nySesjon, sok)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onLukk} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#BA0C2F]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#BA0C2F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F1923]">Importer fra Stortinget</h2>
              <p className="text-xs text-gray-500">Hent saker direkte fra Stortingets åpne data</p>
            </div>
          </div>
          <button onClick={onLukk} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Søk */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <form onSubmit={handleSok} className="flex items-center gap-3">
            <select
              value={sesjon}
              onChange={e => handleSesjonEndring(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
            >
              {SESJONER.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={sokInput}
                onChange={e => setSokInput(e.target.value)}
                placeholder="Søk etter saker (f.eks. &laquo;helse&raquo;, &laquo;klima&raquo;, &laquo;skatt&raquo;)..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={laster || !sokInput.trim()}
              className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {laster ? 'Søker...' : 'Søk'}
            </button>
          </form>
        </div>

        {/* Resultater */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {feil && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg mb-4">
              {feil}
            </div>
          )}

          {!harSokt && !laster && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Søk etter saker fra Stortinget for å importere dem</p>
              <p className="text-xs text-gray-400 mt-1">Du kan søke på tittel, emne eller saksnummer</p>
            </div>
          )}

          {laster && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-gray-200 border-t-[#4A9EDB] rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">Henter saker fra Stortinget...</p>
            </div>
          )}

          {harSokt && !laster && saker.length === 0 && !feil && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">Ingen saker funnet for &laquo;{sok}&raquo;</p>
              <p className="text-xs text-gray-400 mt-1">Prøv et annet søkeord eller en annen sesjon</p>
            </div>
          )}

          {harSokt && !laster && saker.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                {antall} treff{antall > 100 ? ' (viser maks 100)' : ''}
              </p>
              <div className="space-y-2">
                {saker.map(sak => (
                  <div
                    key={sak.id}
                    className="group border border-gray-200 rounded-lg p-4 hover:border-[#4A9EDB] hover:bg-blue-50/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            STATUS_FARGE[sak.status] ?? 'bg-gray-100 text-gray-600'
                          }`}>
                            {sak.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400">
                            {TYPE_LABEL[sak.type] ?? sak.type}
                          </span>
                          {sak.komite && (
                            <span className="text-xs text-gray-400">
                              • {sak.komite}
                            </span>
                          )}
                          <span className="text-xs text-gray-300">#{sak.id}</span>
                        </div>
                        <h3 className="text-sm font-medium text-[#0F1923] leading-snug">
                          {sak.korttittel || sak.tittel}
                        </h3>
                        {sak.korttittel && sak.tittel !== sak.korttittel && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sak.tittel}</p>
                        )}
                        {/* Datoer fra Stortinget */}
                        {(sak.innstilling_dato || sak.behandling_dato) && (
                          <div className="flex items-center gap-3 mt-1.5">
                            {sak.innstilling_dato && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                </svg>
                                Innstilling: {new Date(sak.innstilling_dato).toLocaleDateString('nb-NO')}
                              </span>
                            )}
                            {sak.behandling_dato && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21" />
                                </svg>
                                Sal: {new Date(sak.behandling_dato).toLocaleDateString('nb-NO')}
                              </span>
                            )}
                          </div>
                        )}
                        {sak.emner.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {sak.emner.slice(0, 4).map((emne, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {emne}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onImporter(sak)}
                        className="shrink-0 px-3 py-1.5 text-xs bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Importer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
          <p className="text-xs text-gray-400">
            Kilde: data.stortinget.no
          </p>
          <button
            onClick={onLukk}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  )
}
