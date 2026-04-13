'use client'

import { useState } from 'react'
import { opprettSak, type SakFormData } from '@/lib/actions'
import { PARTIER } from '@/lib/types'
import type { Stemme } from '@/lib/types'

// Mapping fra Stortingets parti-IDer til våre kortnavn
const PARTI_MAP: Record<string, string> = {
  A: 'Ap',
  H: 'H',
  FrP: 'FrP',
  SV: 'SV',
  Sp: 'SP',
  V: 'V',
  KrF: 'KrF',
  MDG: 'MDG',
  R: 'R',
  // Varianter
  Ap: 'Ap',
  SP: 'SP',
}

interface Votering {
  votering_id: string
  sak_id: string
  vedtatt: boolean
  votering_tema: string
  votering_tid: string | null
  antall_for: number
  antall_mot: number
  antall_ikke_tilstede: number
  votering_resultat_type: string
}

interface PartiResultat {
  parti: string
  antall_for: number
  antall_mot: number
  antall_ikke_tilstede: number
}

interface Props {
  sakId: string
  stortingsSakId: string  // Sak-ID fra Stortinget (f.eks. "87318")
  onImportert: () => void
}

export default function VoteringImport({ sakId, stortingsSakId, onImportert }: Props) {
  const [laster, setLaster] = useState(false)
  const [importerer, setImporterer] = useState(false)
  const [voteringer, setVoteringer] = useState<Votering[] | null>(null)
  const [valgte, setValgte] = useState<Set<string>>(new Set())
  const [partiData, setPartiData] = useState<Record<string, PartiResultat[]>>({})
  const [feil, setFeil] = useState('')
  const [importStatus, setImportStatus] = useState({ ferdig: 0, totalt: 0 })

  async function hentVoteringer() {
    setLaster(true)
    setFeil('')
    try {
      const res = await fetch(`/api/stortinget?voteringer=${encodeURIComponent(stortingsSakId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Feil ved henting')

      setVoteringer(data.voteringer ?? [])

      // Hent partiresultater for alle voteringer parallelt
      if (data.voteringer?.length > 0) {
        const partiPromises = data.voteringer.map(async (v: Votering) => {
          const partiRes = await fetch(`/api/stortinget?partiresultat=${encodeURIComponent(v.votering_id)}`)
          const partiData = await partiRes.json()
          return { voteringId: v.votering_id, partier: partiData.partier ?? [] }
        })
        const resultater = await Promise.all(partiPromises)
        const map: Record<string, PartiResultat[]> = {}
        for (const r of resultater) {
          map[r.voteringId] = r.partier
        }
        setPartiData(map)
      }
    } catch (err) {
      setFeil(err instanceof Error ? err.message : 'Kunne ikke hente voteringer')
    } finally {
      setLaster(false)
    }
  }

  function toggleVotering(voteringId: string) {
    setValgte(prev => {
      const ny = new Set(prev)
      if (ny.has(voteringId)) ny.delete(voteringId)
      else ny.add(voteringId)
      return ny
    })
  }

  function velgAlle() {
    if (!voteringer) return
    if (valgte.size === voteringer.length) {
      setValgte(new Set())
    } else {
      setValgte(new Set(voteringer.map(v => v.votering_id)))
    }
  }

  function mapPartiStemme(partier: PartiResultat[]): { parti: string; stemme: Stemme }[] {
    return PARTIER.map(p => {
      const match = partier.find(pr => PARTI_MAP[pr.parti] === p)
      if (!match) return { parti: p, stemme: 'ukjent' as Stemme }
      if (match.antall_for > match.antall_mot) return { parti: p, stemme: 'for' as Stemme }
      if (match.antall_mot > match.antall_for) return { parti: p, stemme: 'mot' as Stemme }
      return { parti: p, stemme: 'ukjent' as Stemme }
    })
  }

  async function importerValgte() {
    if (valgte.size === 0 || !voteringer) return
    setImporterer(true)
    setFeil('')
    setImportStatus({ ferdig: 0, totalt: valgte.size })

    const valgteVoteringer = voteringer.filter(v => valgte.has(v.votering_id))

    for (const votering of valgteVoteringer) {
      const stemmer = mapPartiStemme(partiData[votering.votering_id] ?? [])

      const formData: SakFormData = {
        tittel: votering.votering_tema || `Votering ${votering.votering_id}`,
        beskrivelse: null,
        niva: null,
        landing: votering.vedtatt ? 'vedtatt' : 'ukjent',
        komite_id: null,
        stortingssak_ref: null,
        sesjon: null,
        komite_dato: null,
        stortings_dato: votering.votering_tid,
        forelder_id: sakId,
        stemmer,
      }

      const result = await opprettSak(formData)
      if (!result.success) {
        setFeil(`Feil ved import av "${votering.votering_tema}": ${result.error}`)
        setImporterer(false)
        return
      }
      setImportStatus(prev => ({ ...prev, ferdig: prev.ferdig + 1 }))
    }

    setImporterer(false)
    setVoteringer(null)
    setValgte(new Set())
    onImportert()
  }

  // Ikke vist ennå — vis knapp
  if (!voteringer) {
    return (
      <button
        onClick={hentVoteringer}
        disabled={laster}
        className="flex items-center gap-1.5 text-xs text-[#4A9EDB] hover:text-[#3a8ecb] transition-colors disabled:opacity-50"
      >
        {laster ? (
          <>
            <div className="animate-spin w-3 h-3 border-2 border-gray-200 border-t-[#4A9EDB] rounded-full" />
            Henter voteringer...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Hent voteringer fra Stortinget
          </>
        )}
      </button>
    )
  }

  // Ingen voteringer funnet
  if (voteringer.length === 0) {
    return (
      <div className="text-xs text-gray-400 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        Ingen voteringer funnet for denne saken ennå.
        <button onClick={() => setVoteringer(null)} className="text-[#4A9EDB] hover:underline">Prøv igjen</button>
      </div>
    )
  }

  // Vis voteringer med checkboxer
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {voteringer.length} votering{voteringer.length > 1 ? 'er' : ''} funnet — velg de som er relevante:
        </p>
        <div className="flex items-center gap-2">
          <button onClick={velgAlle} className="text-xs text-[#4A9EDB] hover:underline">
            {valgte.size === voteringer.length ? 'Fjern alle' : 'Velg alle'}
          </button>
          <button onClick={() => setVoteringer(null)} className="text-xs text-gray-400 hover:text-gray-600">
            Avbryt
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {voteringer.map(v => {
          const erValgt = valgte.has(v.votering_id)
          const partier = partiData[v.votering_id] ?? []

          return (
            <label
              key={v.votering_id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                erValgt ? 'border-[#4A9EDB]/40 bg-[#4A9EDB]/5' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={erValgt}
                onChange={() => toggleVotering(v.votering_id)}
                className="mt-0.5 rounded border-gray-300 text-[#4A9EDB] focus:ring-[#4A9EDB]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#0F1923] leading-snug">
                  {v.votering_tema || 'Uten tema'}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    v.vedtatt ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {v.vedtatt ? 'Vedtatt' : 'Ikke vedtatt'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {v.antall_for} for / {v.antall_mot} mot
                  </span>
                  {v.votering_tid && (
                    <span className="text-xs text-gray-400">
                      {new Date(v.votering_tid).toLocaleDateString('nb-NO')}
                    </span>
                  )}
                </div>
                {/* Mini parti-indikatorer */}
                {partier.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {PARTIER.map(p => {
                      const match = partier.find(pr => PARTI_MAP[pr.parti] === p)
                      if (!match) return (
                        <span key={p} className="inline-flex items-center gap-0.5 text-[10px] text-gray-300">
                          {p}
                        </span>
                      )
                      const stemme = match.antall_for > match.antall_mot ? 'for' : match.antall_mot > match.antall_for ? 'mot' : 'ukjent'
                      return (
                        <span
                          key={p}
                          className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded ${
                            stemme === 'for' ? 'bg-emerald-100 text-emerald-700' :
                            stemme === 'mot' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-400'
                          }`}
                          title={`${p}: ${match.antall_for} for, ${match.antall_mot} mot`}
                        >
                          {p}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {feil && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{feil}</div>
      )}

      {importerer && (
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-[#4A9EDB] rounded-full" />
          <span className="text-xs text-gray-500">
            Importerer... ({importStatus.ferdig}/{importStatus.totalt})
          </span>
        </div>
      )}

      <button
        onClick={importerValgte}
        disabled={valgte.size === 0 || importerer}
        className="w-full px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
      >
        {valgte.size > 0
          ? `Importer ${valgte.size} votering${valgte.size > 1 ? 'er' : ''} som delsak${valgte.size > 1 ? 'er' : ''}`
          : 'Velg voteringer å importere'
        }
      </button>
    </div>
  )
}
