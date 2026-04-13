'use client'

import { useState } from 'react'
import { opprettSak, oppdaterPartistemmer, type SakFormData, type SakMedStemmer } from '@/lib/actions'
import { PARTIER } from '@/lib/types'
import type { Stemme } from '@/lib/types'

// Mapping fra Stortingets parti-IDer til våre kortnavn
const PARTI_MAP: Record<string, string> = {
  A: 'Ap', H: 'H', FrP: 'FrP', SV: 'SV', Sp: 'SP',
  V: 'V', KrF: 'KrF', MDG: 'MDG', R: 'R',
  Ap: 'Ap', SP: 'SP',
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
  votering_resultat_tekst: string
  kommentar: string | null
}

interface PartiResultat {
  parti: string
  antall_for: number
  antall_mot: number
  antall_ikke_tilstede: number
}

// Hva brukeren velger per votering: knytt til delsak, opprett ny, eller ignorer
type VoteringValg =
  | { type: 'ignorer' }
  | { type: 'ny_delsak' }
  | { type: 'eksisterende'; delsakId: string }

interface Props {
  sakId: string
  stortingsSakId: string
  delsaker: SakMedStemmer[]
  onImportert: () => void
}

export default function VoteringImport({ sakId, stortingsSakId, delsaker, onImportert }: Props) {
  const [laster, setLaster] = useState(false)
  const [importerer, setImporterer] = useState(false)
  const [voteringer, setVoteringer] = useState<Votering[] | null>(null)
  const [partiData, setPartiData] = useState<Record<string, PartiResultat[]>>({})
  const [valg, setValg] = useState<Record<string, VoteringValg>>({})
  const [feil, setFeil] = useState('')
  const [importStatus, setImportStatus] = useState({ ferdig: 0, totalt: 0 })

  async function hentVoteringer() {
    setLaster(true)
    setFeil('')
    try {
      const res = await fetch(`/api/stortinget?voteringer=${encodeURIComponent(stortingsSakId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Feil ved henting')

      const liste: Votering[] = data.voteringer ?? []
      setVoteringer(liste)

      // Sett standard: alle er "ignorer"
      const defaultValg: Record<string, VoteringValg> = {}
      for (const v of liste) {
        defaultValg[v.votering_id] = { type: 'ignorer' }
      }
      setValg(defaultValg)

      // Hent partiresultater parallelt
      if (liste.length > 0) {
        const promises = liste.map(async (v) => {
          const partiRes = await fetch(`/api/stortinget?partiresultat=${encodeURIComponent(v.votering_id)}`)
          const partiJson = await partiRes.json()
          return { voteringId: v.votering_id, partier: partiJson.partier ?? [] }
        })
        const resultater = await Promise.all(promises)
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

  function oppdaterValg(voteringId: string, nyttValg: VoteringValg) {
    setValg(prev => ({ ...prev, [voteringId]: nyttValg }))
  }

  function mapPartiStemmer(partier: PartiResultat[]): { parti: string; stemme: Stemme }[] {
    return PARTIER.map(p => {
      const match = partier.find(pr => PARTI_MAP[pr.parti] === p)
      if (!match) return { parti: p, stemme: 'ukjent' as Stemme }
      if (match.antall_for > match.antall_mot) return { parti: p, stemme: 'for' as Stemme }
      if (match.antall_mot > match.antall_for) return { parti: p, stemme: 'mot' as Stemme }
      return { parti: p, stemme: 'ukjent' as Stemme }
    })
  }

  // Tell antall aktive (ikke-ignorerte) valg
  const aktiveValg = Object.values(valg).filter(v => v.type !== 'ignorer').length

  async function importer() {
    if (aktiveValg === 0 || !voteringer) return
    setImporterer(true)
    setFeil('')
    setImportStatus({ ferdig: 0, totalt: aktiveValg })

    for (const votering of voteringer) {
      const v = valg[votering.votering_id]
      if (!v || v.type === 'ignorer') continue

      const stemmer = mapPartiStemmer(partiData[votering.votering_id] ?? [])

      if (v.type === 'eksisterende') {
        // Oppdater partistemmer på eksisterende delsak
        const result = await oppdaterPartistemmer(v.delsakId, stemmer)
        if (!result.success) {
          setFeil(`Feil ved oppdatering: ${result.error}`)
          setImporterer(false)
          return
        }
      } else {
        // Opprett ny delsak
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
          setFeil(`Feil ved oppretting: ${result.error}`)
          setImporterer(false)
          return
        }
      }
      setImportStatus(prev => ({ ...prev, ferdig: prev.ferdig + 1 }))
    }

    setImporterer(false)
    setVoteringer(null)
    setValg({})
    onImportert()
  }

  // ── Ikke hentet ennå ──
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

  // ── Ingen voteringer ──
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

  // ── Vis voteringer med matching ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {voteringer.length} votering{voteringer.length > 1 ? 'er' : ''} funnet — velg handling for de relevante:
        </p>
        <button onClick={() => setVoteringer(null)} className="text-xs text-gray-400 hover:text-gray-600">
          Lukk
        </button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {voteringer.map(v => {
          const valgForVotering = valg[v.votering_id] ?? { type: 'ignorer' }
          const partier = partiData[v.votering_id] ?? []
          const erAktiv = valgForVotering.type !== 'ignorer'

          return (
            <div
              key={v.votering_id}
              className={`p-3 rounded-lg border transition-colors ${
                erAktiv ? 'border-[#4A9EDB]/40 bg-[#4A9EDB]/5' : 'border-gray-100'
              }`}
            >
              {/* Innhold */}
              <div className="mb-2">
                <div className="text-sm font-medium text-[#0F1923] leading-snug">
                  {v.votering_tema || 'Uten tema'}
                </div>
                {v.votering_resultat_tekst && (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {v.votering_resultat_tekst}
                  </p>
                )}
                {v.kommentar && (
                  <p className="text-xs text-gray-400 mt-0.5 italic">
                    {v.kommentar}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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
                {/* Parti-indikatorer */}
                {partier.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {PARTIER.map(p => {
                      const match = partier.find(pr => PARTI_MAP[pr.parti] === p)
                      if (!match) return (
                        <span key={p} className="inline-flex items-center text-[10px] text-gray-300 px-1 py-0.5">
                          {p}
                        </span>
                      )
                      const stemme = match.antall_for > match.antall_mot ? 'for' : match.antall_mot > match.antall_for ? 'mot' : 'ukjent'
                      return (
                        <span
                          key={p}
                          className={`inline-flex items-center text-[10px] px-1 py-0.5 rounded ${
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

              {/* Handlingsvalg */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <select
                  value={
                    valgForVotering.type === 'ignorer' ? '__ignorer' :
                    valgForVotering.type === 'ny_delsak' ? '__ny' :
                    valgForVotering.delsakId
                  }
                  onChange={e => {
                    const val = e.target.value
                    if (val === '__ignorer') oppdaterValg(v.votering_id, { type: 'ignorer' })
                    else if (val === '__ny') oppdaterValg(v.votering_id, { type: 'ny_delsak' })
                    else oppdaterValg(v.votering_id, { type: 'eksisterende', delsakId: val })
                  }}
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                >
                  <option value="__ignorer">— Hopp over</option>
                  {delsaker.length > 0 && (
                    <optgroup label="Knytt til eksisterende delsak">
                      {delsaker.map(d => (
                        <option key={d.id} value={d.id}>{d.tittel}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__ny">+ Opprett som ny delsak</option>
                </select>
              </div>
            </div>
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
        onClick={importer}
        disabled={aktiveValg === 0 || importerer}
        className="w-full px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
      >
        {aktiveValg > 0
          ? `Importer ${aktiveValg} votering${aktiveValg > 1 ? 'er' : ''}`
          : 'Velg handling for voteringer'}
      </button>
    </div>
  )
}
