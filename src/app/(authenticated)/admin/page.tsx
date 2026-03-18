'use client'

import { useEffect, useState, useCallback } from 'react'
import { PARTIER } from '@/lib/types'
import {
  hentKomiteerMedMandater,
  hentStortingsmandater,
  opprettKomite,
  oppdaterKomite,
  slettKomite,
  oppdaterKomiteMandater,
  oppdaterStortingsmandater,
  type KomiteMedMandater,
} from '@/lib/actions'
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
  const [komiteer, setKomiteer] = useState<KomiteMedMandater[]>([])
  const [stortingsmandater, setStortingsmandater] = useState<Record<string, number>>({})
  const [laster, setLaster] = useState(true)
  const [nyttKomiteNavn, setNyttKomiteNavn] = useState('')
  const [redigererKomite, setRedigererKomite] = useState<string | null>(null)
  const [redigertNavn, setRedigertNavn] = useState('')
  const [redigertMandater, setRedigertMandater] = useState<Record<string, number>>({})
  const [lagrer, setLagrer] = useState(false)
  const [lagrerStorting, setLagrerStorting] = useState(false)
  const [bekreftSlett, setBekreftSlett] = useState<string | null>(null)

  const lastData = useCallback(async () => {
    const [k, s] = await Promise.all([
      hentKomiteerMedMandater(),
      hentStortingsmandater(),
    ])
    setKomiteer(k)
    setStortingsmandater(toRecord(s))
    setLaster(false)
  }, [])

  useEffect(() => { lastData() }, [lastData])

  async function handleOpprettKomite() {
    if (!nyttKomiteNavn.trim()) return
    setLagrer(true)
    await opprettKomite(nyttKomiteNavn.trim())
    setNyttKomiteNavn('')
    setLagrer(false)
    lastData()
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
    lastData()
  }

  async function handleSlettKomite(komiteId: string) {
    setLagrer(true)
    await slettKomite(komiteId)
    setBekreftSlett(null)
    setLagrer(false)
    lastData()
  }

  async function lagreStortingsmandater() {
    setLagrerStorting(true)
    await oppdaterStortingsmandater(toArray(stortingsmandater))
    setLagrerStorting(false)
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
      {/* Stortingsmandater */}
      <div>
        <h1 className="text-xl font-bold text-[#0F1923] mb-1">Stortingsmandater</h1>
        <p className="text-sm text-gray-500 mb-4">Mandatfordeling i Stortingssalen</p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <MandatEditor mandater={stortingsmandater} onChange={setStortingsmandater} />
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
