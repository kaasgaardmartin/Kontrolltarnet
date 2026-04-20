'use client'

import { useState, useEffect } from 'react'
import { hentHoringer, lagreHoringer, slettHoring, type Horing } from '@/lib/actions'
import type { StortingetHoring } from '@/app/api/stortinget/route'

function formaterDato(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fristFarge(iso: string | null): string {
  if (!iso) return 'text-gray-400'
  const dager = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (dager < 0) return 'text-gray-400 line-through'
  if (dager <= 3) return 'text-red-600 font-semibold'
  if (dager <= 7) return 'text-amber-600 font-medium'
  return 'text-emerald-700'
}

function DagerTil({ iso }: { iso: string | null }) {
  if (!iso) return null
  const dager = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (dager < 0) return <span className="text-xs text-gray-400">({Math.abs(dager)}d siden)</span>
  if (dager === 0) return <span className="text-xs text-red-600 font-medium">(i dag!)</span>
  if (dager === 1) return <span className="text-xs text-red-600">(i morgen)</span>
  return <span className="text-xs text-gray-400">(om {dager}d)</span>
}

interface Props {
  sakId: string
  stortingsSakId: string
  horinger: Horing[]
  onOppdatert: () => void
}

export default function HoringSeksjon({ sakId, stortingsSakId, horinger: initialHoringer, onOppdatert }: Props) {
  const [horinger, setHoringer] = useState<Horing[]>(initialHoringer)
  const [henter, setHenter] = useState(false)
  const [funnet, setFunnet] = useState<StortingetHoring[] | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')
  const [ingenFunnet, setIngenFunnet] = useState(false)

  // Auto-hent og lagre høringer ved første innlasting hvis ingen er lagret ennå
  useEffect(() => {
    if (initialHoringer.length === 0) {
      autoHentOgImporter()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sakId, stortingsSakId])

  async function autoHentOgImporter() {
    setHenter(true)
    try {
      const res = await fetch(`/api/stortinget?horinger_for_sak=${encodeURIComponent(stortingsSakId)}`)
      const data = await res.json()
      if (!res.ok) return
      const liste: StortingetHoring[] = data.horinger ?? []
      if (liste.length === 0) {
        setIngenFunnet(true)
        return
      }
      // Importer automatisk uten å vise bekreftelsessteget
      const result = await lagreHoringer(sakId, liste)
      if (result.success) {
        const oppdaterte = await hentHoringer(sakId)
        setHoringer(oppdaterte)
        onOppdatert()
      }
    } catch {
      // Still feil — bruker kan prøve manuelt
    } finally {
      setHenter(false)
    }
  }

  async function hentFraStortinget() {
    setHenter(true)
    setFeil('')
    setIngenFunnet(false)
    try {
      const res = await fetch(`/api/stortinget?horinger_for_sak=${encodeURIComponent(stortingsSakId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Feil ved henting')
      const liste: StortingetHoring[] = data.horinger ?? []
      if (liste.length === 0) {
        setIngenFunnet(true)
      } else {
        setFunnet(liste)
      }
    } catch (err) {
      setFeil(err instanceof Error ? err.message : 'Kunne ikke hente høringer')
    } finally {
      setHenter(false)
    }
  }

  async function handleImporter() {
    if (!funnet) return
    setLagrer(true)
    setFeil('')
    const result = await lagreHoringer(sakId, funnet)
    if (!result.success) {
      setFeil(result.error ?? 'Feil ved lagring')
      setLagrer(false)
      return
    }
    // Refresh lokal state
    const oppdaterte = await hentHoringer(sakId)
    setHoringer(oppdaterte)
    setFunnet(null)
    setLagrer(false)
    onOppdatert()
  }

  async function handleSlett(horingId: string) {
    await slettHoring(horingId)
    setHoringer(prev => prev.filter(h => h.id !== horingId))
    onOppdatert()
  }

  const alleImportertIds = new Set(horinger.map(h => h.horing_id))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0F1923]">
          Høringer
          {horinger.length > 0 && (
            <span className="text-gray-400 font-normal ml-1">({horinger.length})</span>
          )}
        </h3>
        {!funnet && (
          <button
            onClick={hentFraStortinget}
            disabled={henter}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#4A9EDB] transition-colors disabled:opacity-50"
            title={horinger.length > 0 ? 'Sjekk for nye høringer' : 'Hent fra Stortinget'}
          >
            {henter ? (
              <div className="animate-spin w-3 h-3 border-2 border-gray-200 border-t-[#4A9EDB] rounded-full" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Lagrede høringer */}
      {horinger.length > 0 && (
        <div className="space-y-2 mb-3">
          {horinger.map(h => (
            <div key={h.id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-[#0F1923] truncate">{h.tittel || 'Høring'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      h.skriftlig ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {h.skriftlig ? 'Skriftlig' : 'Muntlig'}
                    </span>
                    {h.status && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        h.status === 'Avholdt' ? 'bg-gray-100 text-gray-400' :
                        h.status === 'Aktiv' ? 'bg-emerald-100 text-emerald-700' :
                        h.status === 'Planlagt' ? 'bg-blue-100 text-blue-700' :
                        h.status === 'Avlyst' ? 'bg-red-100 text-red-500' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {h.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {h.innspillsfrist && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="text-gray-500">Innspillsfrist:</span>
                        <span className={fristFarge(h.innspillsfrist)}>{formaterDato(h.innspillsfrist)}</span>
                        <DagerTil iso={h.innspillsfrist} />
                      </div>
                    )}
                    {h.anmodningsfrist && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <span className="text-gray-500">Påmelding innen:</span>
                        <span className={fristFarge(h.anmodningsfrist)}>{formaterDato(h.anmodningsfrist)}</span>
                        <DagerTil iso={h.anmodningsfrist} />
                      </div>
                    )}
                    {h.start_dato && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        <span className="text-gray-500">Høring avholdes:</span>
                        <span className="text-gray-700">{formaterDato(h.start_dato)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleSlett(h.id)}
                  className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                  title="Fjern høring"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Laster automatisk */}
      {horinger.length === 0 && henter && (
        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border-2 border-gray-200 border-t-[#4A9EDB] rounded-full animate-spin" />
          Sjekker Stortinget for høringer...
        </p>
      )}

      {/* Ingen høringer funnet (etter auto-henting) */}
      {horinger.length === 0 && !henter && !funnet && !ingenFunnet && (
        <p className="text-xs text-gray-400 mb-2">Ingen høringer funnet for denne saken.</p>
      )}

      {/* Ingen funnet i API */}
      {ingenFunnet && (
        <div className="text-xs text-gray-400 flex items-center gap-2 mb-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          Ingen høringer funnet for denne saken.
          <button onClick={() => setIngenFunnet(false)} className="text-[#4A9EDB] hover:underline">
            Prøv igjen
          </button>
        </div>
      )}

      {/* Funnet fra API — vis og bekreft import */}
      {funnet && (
        <div className="space-y-2 mt-2">
          <p className="text-xs text-gray-500">
            {funnet.length} høring{funnet.length !== 1 ? 'er' : ''} funnet på Stortinget.no:
          </p>
          {funnet.map(h => {
            const erLagret = alleImportertIds.has(h.horing_id)
            return (
              <div key={h.horing_id} className={`p-3 rounded-lg border text-xs ${
                erLagret ? 'border-gray-100 bg-gray-50/30 opacity-60' : 'border-[#4A9EDB]/30 bg-[#4A9EDB]/5'
              }`}>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="font-medium text-[#0F1923]">{h.tittel || 'Høring'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    h.skriftlig ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {h.skriftlig ? 'Skriftlig' : 'Muntlig'}
                  </span>
                  <span className="text-gray-400">· {h.status}</span>
                  {erLagret && <span className="text-gray-400 italic">· allerede importert</span>}
                </div>
                {h.innspillsfrist && (
                  <div className="text-gray-600">
                    Innspillsfrist: <span className={fristFarge(h.innspillsfrist)}>{formaterDato(h.innspillsfrist)}</span>
                  </div>
                )}
                {h.anmodningsfrist && (
                  <div className="text-gray-600">
                    Påmelding innen: <span className={fristFarge(h.anmodningsfrist)}>{formaterDato(h.anmodningsfrist)}</span>
                  </div>
                )}
                {h.start_dato && (
                  <div className="text-gray-500">Avholdes: {formaterDato(h.start_dato)}</div>
                )}
              </div>
            )
          })}

          {feil && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{feil}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleImporter}
              disabled={lagrer}
              className="flex-1 px-3 py-2 text-xs bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
            >
              {lagrer ? 'Lagrer...' : `Importer ${funnet.filter(h => !alleImportertIds.has(h.horing_id)).length} ny${funnet.filter(h => !alleImportertIds.has(h.horing_id)).length !== 1 ? 'e' : ''} høring${funnet.filter(h => !alleImportertIds.has(h.horing_id)).length !== 1 ? 'er' : ''}`}
            </button>
            <button
              onClick={() => { setFunnet(null); setFeil('') }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {feil && !funnet && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{feil}</p>
      )}
    </div>
  )
}
