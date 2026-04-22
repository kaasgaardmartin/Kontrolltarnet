'use client'

import { useState } from 'react'
import { PARTIER } from '@/lib/types'
import {
  opprettKomite,
  oppdaterKomite,
  slettKomite,
  oppdaterKomiteMandater,
  oppdaterStortingsmandater,
  type KomiteMedMandater,
} from '@/lib/actions'
import { useKomiteerMedMandater, useMandater, useInvaliderSakData } from '@/lib/queries'
import MandatEditor from '@/components/MandatEditor'

function toRecord(mandater: { parti: string; antall: number }[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const p of PARTIER) r[p] = 0
  for (const m of mandater) r[m.parti] = m.antall
  return r
}

function toArray(mandater: Record<string, number>) {
  return PARTIER.map(p => ({ parti: p, antall: mandater[p] ?? 0 }))
}

export default function AdminPage() {
  const { data: komiteer = [], isLoading: lasterKomiteer } = useKomiteerMedMandater()
  const { data: mandaterRaw = [], isLoading: lasterMandater } = useMandater()
  const { invaliderAdmin } = useInvaliderSakData()

  const [stortingsmandater, setStortingsmandater] = useState<Record<string, number> | null>(null)
  const [nyttKomiteNavn, setNyttKomiteNavn] = useState('')
  const [redigererKomite, setRedigererKomite] = useState<string | null>(null)
  const [redigertNavn, setRedigertNavn] = useState('')
  const [redigertMandater, setRedigertMandater] = useState<Record<string, number>>({})
  const [lagrer, setLagrer] = useState(false)
  const [lagrerStorting, setLagrerStorting] = useState(false)
  const [bekreftSlett, setBekreftSlett] = useState<string | null>(null)

  // Reimport-state
  const [reimportStatus, setReimportStatus] = useState<'idle' | 'kjorer' | 'ferdig' | 'feil'>('idle')
  const [reimportResultat, setReimportResultat] = useState<{ antall: number; oppdatert: number; feil: number } | null>(null)

  async function handleReimport() {
    setReimportStatus('kjorer')
    setReimportResultat(null)
    try {
      const res = await fetch('/api/reimport-saker', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReimportResultat({ antall: data.antall, oppdatert: data.oppdatert, feil: data.feil })
      setReimportStatus('ferdig')
    } catch {
      setReimportStatus('feil')
    }
  }

  // Backfill publisert_dato-state
  const [backfillStatus, setBackfillStatus] = useState<'idle' | 'kjorer' | 'ferdig' | 'feil'>('idle')
  const [backfillResultat, setBackfillResultat] = useState<{ antall: number; oppdatert: number; ingen_dato: number; feil: number } | null>(null)

  async function handleBackfill() {
    setBackfillStatus('kjorer')
    setBackfillResultat(null)
    try {
      const res = await fetch('/api/backfill-publisert-dato', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBackfillResultat({ antall: data.antall, oppdatert: data.oppdatert, ingen_dato: data.ingen_dato, feil: data.feil })
      setBackfillStatus('ferdig')
    } catch {
      setBackfillStatus('feil')
    }
  }

  // Bruk lokalt redigerte mandater hvis de finnes, ellers data fra server
  const visStortingsmandater = stortingsmandater ?? toRecord(mandaterRaw)

  const laster = lasterKomiteer || lasterMandater

  async function handleOpprettKomite() {
    if (!nyttKomiteNavn.trim()) return
    setLagrer(true)
    await opprettKomite(nyttKomiteNavn.trim())
    setNyttKomiteNavn('')
    setLagrer(false)
    invaliderAdmin()
  }

  function startRediger(komite: KomiteMedMandater) {
    setRedigererKomite(komite.id)
    setRedigertNavn(komite.navn)
    setRedigertMandater(toRecord(komite.komite_mandater))
  }

  async function lagreKomite(komiteId: string) {
    setLagrer(true)
    await oppdaterKomite(komiteId, redigertNavn.trim())
    await oppdaterKomiteMandater(komiteId, toArray(redigertMandater))
    setRedigererKomite(null)
    setLagrer(false)
    invaliderAdmin()
  }

  async function handleSlettKomite(komiteId: string) {
    setLagrer(true)
    await slettKomite(komiteId)
    setBekreftSlett(null)
    setLagrer(false)
    invaliderAdmin()
  }

  async function lagreStortingsmandater() {
    setLagrerStorting(true)
    await oppdaterStortingsmandater(toArray(visStortingsmandater))
    setStortingsmandater(null)
    setLagrerStorting(false)
    invaliderAdmin()
  }

  if (laster) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-gray-400">Laster...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Reimport saker */}
      <div>
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">Synkroniser saker</h2>
        <p className="text-sm text-gray-500 mb-4">Henter ferske datoer og høringer fra Stortinget for de 20 nyeste sakene</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            {reimportStatus === 'idle' && 'Oppdaterer komitédatoer, stortingsdatoer og høringer.'}
            {reimportStatus === 'kjorer' && (
              <span className="inline-flex items-center gap-2 text-[#4A9EDB]">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Henter data fra Stortinget...
              </span>
            )}
            {reimportStatus === 'ferdig' && reimportResultat && (
              <span className="text-emerald-600">
                ✓ {reimportResultat.oppdatert} av {reimportResultat.antall} saker oppdatert
                {reimportResultat.feil > 0 && <span className="text-amber-500 ml-2">({reimportResultat.feil} feil)</span>}
              </span>
            )}
            {reimportStatus === 'feil' && <span className="text-red-500">Noe gikk galt — prøv igjen</span>}
          </div>
          <button
            onClick={handleReimport}
            disabled={reimportStatus === 'kjorer'}
            className="shrink-0 px-4 py-2 text-sm bg-[#0F1923] text-white rounded-lg hover:bg-[#1a2836] transition-colors disabled:opacity-50"
          >
            {reimportStatus === 'kjorer' ? 'Kjører...' : 'Last inn på nytt'}
          </button>
        </div>
      </div>

      {/* Backfill publisert_dato */}
      <div>
        <h2 className="text-xl font-bold text-[#0F1923] mb-1">Fyll inn manglende sendedatoer</h2>
        <p className="text-sm text-gray-500 mb-4">Scraper regjeringen.no for alle høringer som mangler «Sendt»-dato</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            {backfillStatus === 'idle' && 'Går gjennom høringer med URL men uten sendedato og fyller inn automatisk.'}
            {backfillStatus === 'kjorer' && (
              <span className="inline-flex items-center gap-2 text-[#4A9EDB]">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Scraper regjeringen.no...
              </span>
            )}
            {backfillStatus === 'ferdig' && backfillResultat && (
              <span className="text-emerald-600">
                {backfillResultat.antall === 0
                  ? 'Alle høringer har allerede en sendedato'
                  : `✓ ${backfillResultat.oppdatert} av ${backfillResultat.antall} oppdatert`
                }
                {backfillResultat.ingen_dato > 0 && <span className="text-gray-400 ml-2">({backfillResultat.ingen_dato} uten synlig dato på siden)</span>}
                {backfillResultat.feil > 0 && <span className="text-amber-500 ml-2">({backfillResultat.feil} feil)</span>}
              </span>
            )}
            {backfillStatus === 'feil' && <span className="text-red-500">Noe gikk galt — prøv igjen</span>}
          </div>
          <button
            onClick={handleBackfill}
            disabled={backfillStatus === 'kjorer'}
            className="shrink-0 px-4 py-2 text-sm bg-[#0F1923] text-white rounded-lg hover:bg-[#1a2836] transition-colors disabled:opacity-50"
          >
            {backfillStatus === 'kjorer' ? 'Kjører...' : 'Fyll inn datoer'}
          </button>
        </div>
      </div>

      {/* Stortingsmandater */}
      <div>
        <h1 className="text-xl font-bold text-[#0F1923] mb-1">Stortingsmandater</h1>
        <p className="text-sm text-gray-500 mb-4">Mandatfordeling i Stortingssalen</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <MandatEditor mandater={visStortingsmandater} onChange={setStortingsmandater} />
          <div className="mt-4 flex justify-end">
            <button
              onClick={lagreStortingsmandater}
              disabled={lagrerStorting}
              className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
            >
              {lagrerStorting ? 'Lagrer...' : 'Lagre mandater'}
            </button>
          </div>
        </div>
      </div>

      {/* Komiteer */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F1923]">Komiteer</h2>
            <p className="text-sm text-gray-500">Administrer komiteer og mandatfordeling</p>
          </div>
        </div>

        {/* Ny komité */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={nyttKomiteNavn}
              onChange={e => setNyttKomiteNavn(e.target.value)}
              placeholder="Navn på ny komité"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && handleOpprettKomite()}
            />
            <button
              onClick={handleOpprettKomite}
              disabled={lagrer || !nyttKomiteNavn.trim()}
              className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
            >
              + Ny komité
            </button>
          </div>
        </div>

        {/* Komitéliste */}
        {komiteer.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">Ingen komiteer opprettet ennå</p>
          </div>
        ) : (
          <div className="space-y-3">
            {komiteer.map(komite => {
              const erRedigering = redigererKomite === komite.id
              const mandatRecord = toRecord(komite.komite_mandater)
              const total = Object.values(mandatRecord).reduce((s, n) => s + n, 0)

              return (
                <div key={komite.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  {erRedigering ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={redigertNavn}
                        onChange={e => setRedigertNavn(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                      />
                      <MandatEditor mandater={redigertMandater} onChange={setRedigertMandater} />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setRedigererKomite(null)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Avbryt
                        </button>
                        <button
                          onClick={() => lagreKomite(komite.id)}
                          disabled={lagrer}
                          className="px-3 py-1.5 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
                        >
                          {lagrer ? 'Lagrer...' : 'Lagre'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-[#0F1923]">{komite.navn}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{total} mandater</span>
                          <button
                            onClick={() => startRediger(komite)}
                            className="text-xs text-[#4A9EDB] hover:underline"
                          >
                            Rediger
                          </button>
                          {bekreftSlett === komite.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSlettKomite(komite.id)}
                                className="text-xs text-white bg-red-500 px-2 py-0.5 rounded hover:bg-red-600"
                              >
                                Bekreft
                              </button>
                              <button
                                onClick={() => setBekreftSlett(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Avbryt
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setBekreftSlett(komite.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Slett
                            </button>
                          )}
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {PARTIER.filter(p => mandatRecord[p] > 0).map(p => (
                            <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {p}: {mandatRecord[p]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
