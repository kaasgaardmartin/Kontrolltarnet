'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMaalOversikt, usePolitiskKvarter, useInvaliderPavirkning } from '@/lib/pavirkning-queries'
import { useOrgBrukere } from '@/lib/queries'
import { maalStatus, statusFarge, forslagTilDagsorden, krStatus, tiltakForfaller, tiltakPassertFrist } from '@/lib/pavirkning-regler'
import {
  startPolitiskKvarter,
  opprettPKDagsorden,
  oppdaterPKMaalUtkast,
  avsluttPolitiskKvarter,
  forkastPolitiskKvarter,
} from '@/lib/pavirkning-actions'
import type { MaalMedDetaljer, NokkelresultatMedTiltak, TiltakAktivitet, PKFase } from '@/lib/pavirkning-types'

// ============================================================
// Fase 1: Dagsorden
// ============================================================

function DagsordenFase({
  maal,
  valgte,
  onToggle,
  onBekreft,
  onAvbryt,
}: {
  maal: MaalMedDetaljer[]
  valgte: Set<string>
  onToggle: (id: string) => void
  onBekreft: () => void
  onAvbryt: () => void
}) {
  const forslag = useMemo(() => {
    const resultat: { maal: MaalMedDetaljer; grunner: string[] }[] = []
    for (const m of maal) {
      const grunner = forslagTilDagsorden(m)
      resultat.push({ maal: m, grunner })
    }
    resultat.sort((a, b) => b.grunner.length - a.grunner.length)
    return resultat
  }, [maal])

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Velg hvilke mål som skal gjennomgås. Mål med varsler er forhåndsvalgt.
      </p>

      <div className="space-y-2">
        {forslag.map(({ maal: m, grunner }) => {
          const status = maalStatus(m.nokkelresultater)
          const farge = statusFarge(status)
          const erValgt = valgte.has(m.id)

          return (
            <label
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                erValgt ? 'border-[#4A9EDB] bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={erValgt}
                onChange={() => onToggle(m.id)}
                className="mt-0.5 rounded border-gray-300 text-[#4A9EDB] focus:ring-[#4A9EDB]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{m.tittel}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: farge + '18', color: farge }}
                  >
                    {status}
                  </span>
                </div>
                {grunner.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {grunner.map((g, i) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {m.tema && (
                  <span className="text-xs text-gray-400 mt-0.5 block">{m.tema.navn}</span>
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <button onClick={onAvbryt} className="text-sm text-gray-500 hover:text-gray-700">
          Avbryt
        </button>
        <button
          onClick={onBekreft}
          disabled={valgte.size === 0}
          className="px-4 py-2 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors"
        >
          Start gjennomgang ({valgte.size} mål)
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Fase 2: Gjennomgang av ett mål
// ============================================================

interface MaalUtkast {
  kommentar: string
  sannsynlighet: Record<string, number>
  tiltak_gjort: string[]
  tiltak_droppet: string[]
  tiltak_utsatt: string[]
  nye_tiltak: { nokkelresultat_id: string; beskrivelse: string; ansvarlig_id: string | null; frist: string }[]
}

function tomtUtkast(): MaalUtkast {
  return {
    kommentar: '',
    sannsynlighet: {},
    tiltak_gjort: [],
    tiltak_droppet: [],
    tiltak_utsatt: [],
    nye_tiltak: [],
  }
}

function GjennomgangFase({
  maal,
  utkast,
  onOppdater,
  onNeste,
  onForrige,
  onHoppOver,
  erForste,
  erSiste,
  indeks,
  totalt,
  brukere,
}: {
  maal: MaalMedDetaljer
  utkast: MaalUtkast
  onOppdater: (u: MaalUtkast) => void
  onNeste: () => void
  onForrige: () => void
  onHoppOver: () => void
  erForste: boolean
  erSiste: boolean
  indeks: number
  totalt: number
  brukere: { id: string; navn: string }[]
}) {
  const [visNyttTiltak, setVisNyttTiltak] = useState<string | null>(null)
  const [nyttTiltakTekst, setNyttTiltakTekst] = useState('')
  const [nyttTiltakAnsvarlig, setNyttTiltakAnsvarlig] = useState('')
  const [nyttTiltakFrist, setNyttTiltakFrist] = useState('')

  const status = maalStatus(maal.nokkelresultater)
  const farge = statusFarge(status)

  function oppdaterSannsynlighet(krId: string, verdi: number) {
    onOppdater({
      ...utkast,
      sannsynlighet: { ...utkast.sannsynlighet, [krId]: verdi },
    })
  }

  function tiltakHandling(tiltakId: string, handling: 'gjort' | 'utsett' | 'dropp' | 'ingen') {
    const gjort = utkast.tiltak_gjort.filter(id => id !== tiltakId)
    const droppet = utkast.tiltak_droppet.filter(id => id !== tiltakId)
    const utsatt = utkast.tiltak_utsatt.filter(id => id !== tiltakId)

    if (handling === 'gjort') gjort.push(tiltakId)
    if (handling === 'dropp') droppet.push(tiltakId)
    if (handling === 'utsett') utsatt.push(tiltakId)

    onOppdater({ ...utkast, tiltak_gjort: gjort, tiltak_droppet: droppet, tiltak_utsatt: utsatt })
  }

  function tiltakStatus(tiltakId: string): 'gjort' | 'utsett' | 'dropp' | 'ingen' {
    if (utkast.tiltak_gjort.includes(tiltakId)) return 'gjort'
    if (utkast.tiltak_droppet.includes(tiltakId)) return 'dropp'
    if (utkast.tiltak_utsatt.includes(tiltakId)) return 'utsett'
    return 'ingen'
  }

  function leggTilTiltak(krId: string) {
    if (!nyttTiltakTekst.trim()) return
    onOppdater({
      ...utkast,
      nye_tiltak: [
        ...utkast.nye_tiltak,
        {
          nokkelresultat_id: krId,
          beskrivelse: nyttTiltakTekst.trim(),
          ansvarlig_id: nyttTiltakAnsvarlig || null,
          frist: nyttTiltakFrist || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        },
      ],
    })
    setNyttTiltakTekst('')
    setNyttTiltakAnsvarlig('')
    setNyttTiltakFrist('')
    setVisNyttTiltak(null)
  }

  function fjernNyttTiltak(indeks: number) {
    onOppdater({
      ...utkast,
      nye_tiltak: utkast.nye_tiltak.filter((_, i) => i !== indeks),
    })
  }

  return (
    <div className="space-y-5">
      {/* Mål-header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Mål {indeks + 1} av {totalt}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: farge + '18', color: farge }}
          >
            {status}
          </span>
        </div>
        <button
          onClick={onHoppOver}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Hopp over
        </button>
      </div>

      <h2 className="text-lg font-semibold text-gray-900">{maal.tittel}</h2>
      {maal.formulering && (
        <p className="text-sm text-gray-600">{maal.formulering}</p>
      )}

      {/* Siste kommentar */}
      {maal.siste_kommentar && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Siste kommentar</p>
          <p className="text-sm text-gray-700">{maal.siste_kommentar}</p>
        </div>
      )}

      {/* Nøkkelresultater */}
      <div className="space-y-4">
        {maal.nokkelresultater.map(kr => {
          const krS = krStatus(kr)
          const krF = statusFarge(krS)
          const nySann = utkast.sannsynlighet[kr.id] ?? kr.sannsynlighet
          const aapneTiltak = kr.tiltak.filter(t => t.status === 'planlagt')
          const nyeTiltakForKR = utkast.nye_tiltak.filter(t => t.nokkelresultat_id === kr.id)

          return (
            <div key={kr.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
              {/* KR header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: krF }}
                    />
                    <span className="text-sm font-medium text-gray-900">{kr.tekst}</span>
                  </div>
                  {kr.frist_tekst && (
                    <span className="text-xs text-gray-400 ml-4">{kr.frist_tekst}</span>
                  )}
                </div>
                {kr.oppnadd && (
                  <span className="text-xs text-green-600 font-medium">Oppnådd</span>
                )}
              </div>

              {/* Sannsynlighet-slider */}
              {!kr.oppnadd && kr.type !== 'gjennomslag' && (
                <div className="ml-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 w-24">Sannsynlighet</label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={nySann}
                      onChange={e => oppdaterSannsynlighet(kr.id, parseInt(e.target.value))}
                      className="flex-1 h-1.5 accent-[#4A9EDB]"
                    />
                    <span className={`text-sm font-medium w-8 text-right ${
                      nySann !== kr.sannsynlighet ? 'text-[#4A9EDB]' : 'text-gray-600'
                    }`}>
                      {nySann}
                    </span>
                    {nySann !== kr.sannsynlighet && (
                      <span className="text-xs text-gray-400">
                        ({kr.sannsynlighet > nySann ? '' : '+'}{nySann - kr.sannsynlighet})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Åpne tiltak */}
              {aapneTiltak.length > 0 && (
                <div className="ml-4 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Tiltak</p>
                  {aapneTiltak.map(tiltak => {
                    const ts = tiltakStatus(tiltak.id)
                    const forfalt = tiltakPassertFrist(tiltak)
                    const forfaller = tiltakForfaller(tiltak)

                    return (
                      <div key={tiltak.id} className={`flex items-center gap-2 py-1.5 px-2 rounded ${
                        ts !== 'ingen' ? 'bg-gray-50' : forfalt ? 'bg-red-50' : ''
                      }`}>
                        <span className={`text-sm flex-1 ${ts === 'gjort' ? 'line-through text-gray-400' : ts === 'dropp' ? 'line-through text-red-400' : 'text-gray-700'}`}>
                          {tiltak.beskrivelse}
                        </span>
                        {tiltak.frist && (
                          <span className={`text-xs shrink-0 ${forfalt ? 'text-red-600 font-medium' : forfaller ? 'text-amber-600' : 'text-gray-400'}`}>
                            {new Date(tiltak.frist).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        {tiltak.brukere?.navn && (
                          <span className="text-xs text-gray-400 shrink-0">{tiltak.brukere.navn}</span>
                        )}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => tiltakHandling(tiltak.id, ts === 'gjort' ? 'ingen' : 'gjort')}
                            className={`px-1.5 py-0.5 text-xs rounded ${
                              ts === 'gjort' ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
                            }`}
                            title="Gjort"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => tiltakHandling(tiltak.id, ts === 'utsett' ? 'ingen' : 'utsett')}
                            className={`px-1.5 py-0.5 text-xs rounded ${
                              ts === 'utsett' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600'
                            }`}
                            title="Utsett 1 uke"
                          >
                            →
                          </button>
                          <button
                            onClick={() => tiltakHandling(tiltak.id, ts === 'dropp' ? 'ingen' : 'dropp')}
                            className={`px-1.5 py-0.5 text-xs rounded ${
                              ts === 'dropp' ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                            }`}
                            title="Dropp"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Nye tiltak for dette KR */}
              {nyeTiltakForKR.length > 0 && (
                <div className="ml-4 space-y-1">
                  <p className="text-xs font-medium text-green-600">Nye tiltak</p>
                  {nyeTiltakForKR.map((nt, i) => {
                    const globalIdx = utkast.nye_tiltak.indexOf(nt)
                    return (
                      <div key={i} className="flex items-center gap-2 py-1 px-2 bg-green-50 rounded text-sm">
                        <span className="flex-1 text-gray-700">{nt.beskrivelse}</span>
                        {nt.frist && (
                          <span className="text-xs text-gray-400">
                            {new Date(nt.frist).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        <button
                          onClick={() => fjernNyttTiltak(globalIdx)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Legg til tiltak */}
              {!kr.oppnadd && (
                <div className="ml-4">
                  {visNyttTiltak === kr.id ? (
                    <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                      <input
                        type="text"
                        placeholder="Beskrivelse"
                        value={nyttTiltakTekst}
                        onChange={e => setNyttTiltakTekst(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <select
                          value={nyttTiltakAnsvarlig}
                          onChange={e => setNyttTiltakAnsvarlig(e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white flex-1"
                        >
                          <option value="">Velg ansvarlig…</option>
                          {brukere.map(b => (
                            <option key={b.id} value={b.id}>{b.navn}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={nyttTiltakFrist}
                          onChange={e => setNyttTiltakFrist(e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => leggTilTiltak(kr.id)}
                          disabled={!nyttTiltakTekst.trim()}
                          className="px-3 py-1 text-xs rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
                        >
                          Legg til
                        </button>
                        <button
                          onClick={() => { setVisNyttTiltak(null); setNyttTiltakTekst('') }}
                          className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setVisNyttTiltak(kr.id)}
                      className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb]"
                    >
                      + Nytt tiltak
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Kommentar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kommentar til målet
        </label>
        <textarea
          value={utkast.kommentar}
          onChange={e => onOppdater({ ...utkast, kommentar: e.target.value })}
          placeholder="Valgfri statusoppdatering…"
          rows={2}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
        />
      </div>

      {/* Navigasjon */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <button
          onClick={onForrige}
          disabled={erForste}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          ← Forrige
        </button>
        <button
          onClick={onNeste}
          className="px-4 py-2 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] transition-colors"
        >
          {erSiste ? 'Til oppsummering' : 'Neste mål →'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Fase 3: Oppsummering
// ============================================================

function OppsummeringFase({
  dagsordenMaal,
  utkastPrMaal,
  maalData,
  onBekreft,
  onTilbake,
  onForkast,
  laster,
}: {
  dagsordenMaal: string[]
  utkastPrMaal: Record<string, MaalUtkast>
  maalData: MaalMedDetaljer[]
  onBekreft: () => void
  onTilbake: () => void
  onForkast: () => void
  laster: boolean
}) {
  const behandlet = dagsordenMaal.filter(id => {
    const u = utkastPrMaal[id]
    if (!u) return false
    return u.kommentar || Object.keys(u.sannsynlighet).length > 0 ||
      u.tiltak_gjort.length > 0 || u.tiltak_droppet.length > 0 ||
      u.tiltak_utsatt.length > 0 || u.nye_tiltak.length > 0
  })

  const totalEndringer = dagsordenMaal.reduce((sum, id) => {
    const u = utkastPrMaal[id]
    if (!u) return sum
    return sum + Object.keys(u.sannsynlighet).length +
      u.tiltak_gjort.length + u.tiltak_droppet.length +
      u.tiltak_utsatt.length + u.nye_tiltak.length +
      (u.kommentar ? 1 : 0)
  }, 0)

  const alleSannsynligheter: Record<string, number> = {}
  const alleTiltakGjort: string[] = []
  const alleTiltakDroppet: string[] = []
  const alleTiltakUtsatt: string[] = []
  const alleNyeTiltak: typeof utkastPrMaal[string]['nye_tiltak'] = []
  const alleKommentarer: Record<string, string> = {}

  for (const id of dagsordenMaal) {
    const u = utkastPrMaal[id]
    if (!u) continue
    Object.assign(alleSannsynligheter, u.sannsynlighet)
    alleTiltakGjort.push(...u.tiltak_gjort)
    alleTiltakDroppet.push(...u.tiltak_droppet)
    alleTiltakUtsatt.push(...u.tiltak_utsatt)
    alleNyeTiltak.push(...u.nye_tiltak)
    if (u.kommentar) alleKommentarer[id] = u.kommentar
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sammendrag</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="text-gray-500">Mål gjennomgått</div>
          <div className="text-gray-900 font-medium">{behandlet.length} av {dagsordenMaal.length}</div>

          {Object.keys(alleSannsynligheter).length > 0 && (
            <>
              <div className="text-gray-500">Sannsynligheter oppdatert</div>
              <div className="text-gray-900 font-medium">{Object.keys(alleSannsynligheter).length}</div>
            </>
          )}

          {alleTiltakGjort.length > 0 && (
            <>
              <div className="text-gray-500">Tiltak merket gjort</div>
              <div className="text-green-600 font-medium">{alleTiltakGjort.length}</div>
            </>
          )}

          {alleTiltakDroppet.length > 0 && (
            <>
              <div className="text-gray-500">Tiltak droppet</div>
              <div className="text-red-600 font-medium">{alleTiltakDroppet.length}</div>
            </>
          )}

          {alleTiltakUtsatt.length > 0 && (
            <>
              <div className="text-gray-500">Tiltak utsatt</div>
              <div className="text-amber-600 font-medium">{alleTiltakUtsatt.length}</div>
            </>
          )}

          {alleNyeTiltak.length > 0 && (
            <>
              <div className="text-gray-500">Nye tiltak opprettet</div>
              <div className="text-[#4A9EDB] font-medium">{alleNyeTiltak.length}</div>
            </>
          )}

          {Object.keys(alleKommentarer).length > 0 && (
            <>
              <div className="text-gray-500">Kommentarer</div>
              <div className="text-gray-900 font-medium">{Object.keys(alleKommentarer).length}</div>
            </>
          )}
        </div>
      </div>

      {/* Detaljer per mål */}
      {dagsordenMaal.map(maalId => {
        const u = utkastPrMaal[maalId]
        const m = maalData.find(mm => mm.id === maalId)
        if (!u || !m) return null

        const harEndringer = u.kommentar || Object.keys(u.sannsynlighet).length > 0 ||
          u.tiltak_gjort.length > 0 || u.tiltak_droppet.length > 0 ||
          u.tiltak_utsatt.length > 0 || u.nye_tiltak.length > 0

        if (!harEndringer) return null

        return (
          <div key={maalId} className="border border-gray-200 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-900">{m.tittel}</h4>

            {Object.entries(u.sannsynlighet).map(([krId, nySann]) => {
              const kr = m.nokkelresultater.find(k => k.id === krId)
              if (!kr || kr.sannsynlighet === nySann) return null
              return (
                <div key={krId} className="text-xs text-gray-600 ml-2">
                  {kr.tekst}: {kr.sannsynlighet} → <span className={nySann > kr.sannsynlighet ? 'text-green-600' : 'text-red-600'}>{nySann}</span>
                </div>
              )
            })}

            {u.tiltak_gjort.length > 0 && (
              <div className="text-xs text-green-600 ml-2">
                {u.tiltak_gjort.length} tiltak merket gjort
              </div>
            )}
            {u.tiltak_droppet.length > 0 && (
              <div className="text-xs text-red-600 ml-2">
                {u.tiltak_droppet.length} tiltak droppet
              </div>
            )}
            {u.tiltak_utsatt.length > 0 && (
              <div className="text-xs text-amber-600 ml-2">
                {u.tiltak_utsatt.length} tiltak utsatt
              </div>
            )}
            {u.nye_tiltak.length > 0 && (
              <div className="text-xs text-[#4A9EDB] ml-2">
                {u.nye_tiltak.length} nye tiltak
              </div>
            )}
            {u.kommentar && (
              <div className="text-xs text-gray-500 ml-2 italic">&ldquo;{u.kommentar}&rdquo;</div>
            )}
          </div>
        )
      })}

      {totalEndringer === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          Ingen endringer ble gjort i denne gjennomgangen.
        </p>
      )}

      {/* Handlinger */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex gap-2">
          <button onClick={onTilbake} className="text-sm text-gray-500 hover:text-gray-700">
            ← Tilbake
          </button>
          <button
            onClick={onForkast}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Forkast alt
          </button>
        </div>
        <button
          onClick={onBekreft}
          disabled={laster}
          className="px-4 py-2 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors"
        >
          {laster ? 'Lagrer…' : 'Bekreft og avslutt'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Hovedside: Politisk kvarter
// ============================================================

export default function PolitiskKvarterSide() {
  const router = useRouter()
  const { data: alleMaal = [], isLoading: lasterMaal } = useMaalOversikt(false)
  const { data: brukere = [] } = useOrgBrukere()
  const { invaliderAlt } = useInvaliderPavirkning()

  const [fase, setFase] = useState<'init' | PKFase>('init')
  const [pkId, setPkId] = useState<string | null>(null)
  const [valgte, setValgte] = useState<Set<string>>(new Set())
  const [dagsordenMaal, setDagsordenMaal] = useState<string[]>([])
  const [aktivtIndeks, setAktivtIndeks] = useState(0)
  const [utkastPrMaal, setUtkastPrMaal] = useState<Record<string, MaalUtkast>>({})
  const [starter, setStarter] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  // Forhåndsvelg mål med grunner
  const forhåndsvalg = useMemo(() => {
    const med: Set<string> = new Set()
    for (const m of alleMaal) {
      const grunner = forslagTilDagsorden(m)
      if (grunner.length > 0) med.add(m.id)
    }
    return med
  }, [alleMaal])

  // Start møtet
  async function handleStart() {
    setStarter(true)
    setFeil(null)
    const res = await startPolitiskKvarter()
    if (!res.success) {
      if (res.id) {
        setPkId(res.id)
      }
      setFeil(res.error ?? 'Kunne ikke starte møtet')
      setStarter(false)
      return
    }
    setPkId(res.id!)
    setValgte(new Set(forhåndsvalg))
    setFase('dagsorden')
    setStarter(false)
  }

  function toggleMaal(id: string) {
    setValgte(prev => {
      const ny = new Set(prev)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  // Bekreft dagsorden
  async function bekreftDagsorden() {
    if (!pkId) return
    const ider = alleMaal.filter(m => valgte.has(m.id)).map(m => m.id)
    setDagsordenMaal(ider)

    const initUtkast: Record<string, MaalUtkast> = {}
    for (const id of ider) {
      initUtkast[id] = tomtUtkast()
    }
    setUtkastPrMaal(initUtkast)

    const res = await opprettPKDagsorden(pkId, ider)
    if (!res.success) {
      setFeil(res.error ?? 'Feil ved opprettelse av dagsorden')
      return
    }

    setAktivtIndeks(0)
    setFase('gjennomgang')
  }

  // Lagre utkast underveis
  const lagreUtkast = useCallback(async (maalId: string, utkast: MaalUtkast) => {
    if (!pkId) return
    await oppdaterPKMaalUtkast(pkId, maalId, utkast)
  }, [pkId])

  function oppdaterUtkast(maalId: string, utkast: MaalUtkast) {
    setUtkastPrMaal(prev => ({ ...prev, [maalId]: utkast }))
  }

  async function neste() {
    const maalId = dagsordenMaal[aktivtIndeks]
    const utkast = utkastPrMaal[maalId]
    if (utkast) await lagreUtkast(maalId, utkast)

    if (aktivtIndeks < dagsordenMaal.length - 1) {
      setAktivtIndeks(aktivtIndeks + 1)
    } else {
      setFase('oppsummering')
    }
  }

  function forrige() {
    if (aktivtIndeks > 0) setAktivtIndeks(aktivtIndeks - 1)
  }

  async function hoppOver() {
    if (aktivtIndeks < dagsordenMaal.length - 1) {
      setAktivtIndeks(aktivtIndeks + 1)
    } else {
      setFase('oppsummering')
    }
  }

  async function bekreftOgAvslutt() {
    if (!pkId) return
    setLagrer(true)
    setFeil(null)

    const alleSannsynligheter: Record<string, number> = {}
    const alleTiltakGjort: string[] = []
    const alleTiltakDroppet: string[] = []
    const alleTiltakUtsatt: string[] = []
    const alleNyeTiltak: typeof utkastPrMaal[string]['nye_tiltak'] = []
    const alleKommentarer: Record<string, string> = {}

    for (const id of dagsordenMaal) {
      const u = utkastPrMaal[id]
      if (!u) continue
      Object.assign(alleSannsynligheter, u.sannsynlighet)
      alleTiltakGjort.push(...u.tiltak_gjort)
      alleTiltakDroppet.push(...u.tiltak_droppet)
      alleTiltakUtsatt.push(...u.tiltak_utsatt)
      alleNyeTiltak.push(...u.nye_tiltak)
      if (u.kommentar) alleKommentarer[id] = u.kommentar
    }

    const res = await avsluttPolitiskKvarter(pkId, {
      sannsynligheter: alleSannsynligheter,
      tiltak_gjort: alleTiltakGjort,
      tiltak_droppet: alleTiltakDroppet,
      tiltak_utsatt: alleTiltakUtsatt,
      nye_tiltak: alleNyeTiltak,
      kommentarer: alleKommentarer,
    })

    if (!res.success) {
      setFeil(res.error ?? 'Feil ved avslutning')
      setLagrer(false)
      return
    }

    invaliderAlt()
    router.push('/pavirkning')
  }

  async function handleForkast() {
    if (!pkId) return
    setLagrer(true)
    await forkastPolitiskKvarter(pkId)
    invaliderAlt()
    router.push('/pavirkning')
  }

  // Init: venter på start
  if (fase === 'init') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/pavirkning" className="text-sm text-gray-500 hover:text-[#4A9EDB]">
            ← Tilbake
          </Link>
        </div>

        <div className="text-center py-12 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Politisk kvarter</h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Rask gjennomgang av påvirkningsmål. Gå gjennom dagsorden, oppdater
            sannsynligheter og tiltak, og få en samlet oppsummering.
          </p>

          {feil && (
            <p className="text-sm text-red-600">{feil}</p>
          )}

          <button
            onClick={handleStart}
            disabled={starter || lasterMaal}
            className="px-6 py-2.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors"
          >
            {starter ? 'Starter…' : 'Start nytt møte'}
          </button>
        </div>
      </div>
    )
  }

  // Fase 1: Dagsorden
  if (fase === 'dagsorden') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/pavirkning" className="text-sm text-gray-500 hover:text-[#4A9EDB]">
            ← Tilbake
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Dagsorden</h1>
          <span className="text-xs text-gray-400">Steg 1 av 3</span>
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        <DagsordenFase
          maal={alleMaal}
          valgte={valgte}
          onToggle={toggleMaal}
          onBekreft={bekreftDagsorden}
          onAvbryt={() => {
            handleForkast()
          }}
        />
      </div>
    )
  }

  // Fase 2: Gjennomgang
  if (fase === 'gjennomgang') {
    const aktivtMaalId = dagsordenMaal[aktivtIndeks]
    const aktivtMaal = alleMaal.find(m => m.id === aktivtMaalId)
    const aktivtUtkast = utkastPrMaal[aktivtMaalId] ?? tomtUtkast()

    if (!aktivtMaal) return null

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/pavirkning" className="text-sm text-gray-500 hover:text-[#4A9EDB]">
            ← Tilbake
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Gjennomgang</h1>
          <span className="text-xs text-gray-400">Steg 2 av 3</span>
        </div>

        {/* Fremdriftsindikator */}
        <div className="flex gap-1">
          {dagsordenMaal.map((id, i) => (
            <div
              key={id}
              className={`h-1 flex-1 rounded-full ${
                i < aktivtIndeks ? 'bg-[#4A9EDB]' : i === aktivtIndeks ? 'bg-[#4A9EDB]/50' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        <GjennomgangFase
          maal={aktivtMaal}
          utkast={aktivtUtkast}
          onOppdater={(u) => oppdaterUtkast(aktivtMaalId, u)}
          onNeste={neste}
          onForrige={forrige}
          onHoppOver={hoppOver}
          erForste={aktivtIndeks === 0}
          erSiste={aktivtIndeks === dagsordenMaal.length - 1}
          indeks={aktivtIndeks}
          totalt={dagsordenMaal.length}
          brukere={brukere}
        />
      </div>
    )
  }

  // Fase 3: Oppsummering
  if (fase === 'oppsummering') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/pavirkning" className="text-sm text-gray-500 hover:text-[#4A9EDB]">
            ← Tilbake
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Oppsummering</h1>
          <span className="text-xs text-gray-400">Steg 3 av 3</span>
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        <OppsummeringFase
          dagsordenMaal={dagsordenMaal}
          utkastPrMaal={utkastPrMaal}
          maalData={alleMaal}
          onBekreft={bekreftOgAvslutt}
          onTilbake={() => {
            setFase('gjennomgang')
            setAktivtIndeks(dagsordenMaal.length - 1)
          }}
          onForkast={handleForkast}
          laster={lagrer}
        />
      </div>
    )
  }

  return null
}
