'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useMaalOversikt, useTemaer } from '@/lib/pavirkning-queries'
import { maalStatus, statusFarge } from '@/lib/pavirkning-regler'
import MaalLinje from '@/components/pavirkning/MaalLinje'
import type { MaalMedDetaljer, MaalStatusLabel } from '@/lib/pavirkning-types'

export default function PavirkningOversikt() {
  const [fane, setFane] = useState<'aktive' | 'arkiv'>('aktive')
  const [temaFilter, setTemaFilter] = useState<string>('')
  const [sok, setSok] = useState('')
  const [alleUtvidet, setAlleUtvidet] = useState(false)
  const [sammenfoldetTema, setSammenfoldetTema] = useState<Set<string>>(new Set())

  const { data: aktiveMaal = [], isLoading: lasterAktive } = useMaalOversikt(false)
  const { data: arkiverteMaal = [], isLoading: lasterArkiv } = useMaalOversikt(true)
  const { data: temaer = [] } = useTemaer()

  const maal = fane === 'aktive' ? aktiveMaal : arkiverteMaal
  const laster = fane === 'aktive' ? lasterAktive : lasterArkiv

  const filtrerteMaal = useMemo(() => {
    let resultat = maal
    if (temaFilter) {
      resultat = resultat.filter(m => m.tema_id === temaFilter)
    }
    if (sok.trim()) {
      const sokeord = sok.toLowerCase()
      resultat = resultat.filter(m =>
        m.tittel.toLowerCase().includes(sokeord) ||
        m.formulering?.toLowerCase().includes(sokeord) ||
        m.status_tekst?.toLowerCase().includes(sokeord)
      )
    }
    return resultat
  }, [maal, temaFilter, sok])

  // Grupper per tema
  const gruppert = useMemo(() => {
    const grupper = new Map<string, { tema: { id: string; navn: string; rekkefolge: number }; maal: MaalMedDetaljer[] }>()
    for (const m of filtrerteMaal) {
      const temaId = m.tema_id
      const temaNavn = m.tema?.navn ?? 'Uten tema'
      const temaRekkefolge = m.tema?.rekkefolge ?? 99
      if (!grupper.has(temaId)) {
        grupper.set(temaId, { tema: { id: temaId, navn: temaNavn, rekkefolge: temaRekkefolge }, maal: [] })
      }
      grupper.get(temaId)!.maal.push(m)
    }
    return Array.from(grupper.values()).sort((a, b) => a.tema.rekkefolge - b.tema.rekkefolge)
  }, [filtrerteMaal])

  function temaOppsummering(maalListe: MaalMedDetaljer[]): string {
    const statuser = maalListe.map(m => maalStatus(m.nokkelresultater))
    const teller: Partial<Record<MaalStatusLabel, number>> = {}
    for (const s of statuser) {
      teller[s] = (teller[s] ?? 0) + 1
    }
    const deler: string[] = []
    if (teller['I risiko']) deler.push(`${teller['I risiko']} i risiko`)
    if (teller['Usikker']) deler.push(`${teller['Usikker']} usikker`)
    if (teller['På sporet']) deler.push(`${teller['På sporet']} på sporet`)
    if (teller['Oppnådd']) deler.push(`${teller['Oppnådd']} oppnådd`)
    if (teller['Venter']) deler.push(`${teller['Venter']} venter`)
    return deler.join(' · ')
  }

  function toggleTema(temaId: string) {
    setSammenfoldetTema(prev => {
      const ny = new Set(prev)
      if (ny.has(temaId)) ny.delete(temaId)
      else ny.add(temaId)
      return ny
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Påvirkning</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/pavirkning/politisk-kvarter"
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Start politisk kvarter
          </Link>
          <Link
            href="/pavirkning/maal/nytt"
            className="px-3 py-1.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] transition-colors"
          >
            + Nytt mål
          </Link>
        </div>
      </div>

      {/* Faner */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setFane('aktive')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            fane === 'aktive'
              ? 'border-[#4A9EDB] text-[#4A9EDB]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Aktive mål ({aktiveMaal.length})
        </button>
        <button
          onClick={() => setFane('arkiv')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            fane === 'arkiv'
              ? 'border-[#4A9EDB] text-[#4A9EDB]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Arkiv ({arkiverteMaal.length})
        </button>
      </div>

      {/* Filter og søk */}
      <div className="flex items-center gap-3">
        <select
          value={temaFilter}
          onChange={e => setTemaFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700"
        >
          <option value="">Alle temaer</option>
          {temaer.map(t => (
            <option key={t.id} value={t.id}>{t.navn}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Søk i mål…"
          value={sok}
          onChange={e => setSok(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 flex-1 max-w-xs"
        />

        <button
          onClick={() => {
            setAlleUtvidet(!alleUtvidet)
            if (!alleUtvidet) setSammenfoldetTema(new Set())
            else setSammenfoldetTema(new Set(temaer.map(t => t.id)))
          }}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {alleUtvidet ? 'Fold sammen alle' : 'Utvid alle'}
        </button>
      </div>

      {/* Målliste */}
      {laster ? (
        <div className="text-center py-12 text-sm text-gray-400">Laster mål…</div>
      ) : gruppert.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          {sok || temaFilter ? 'Ingen mål funnet' : fane === 'aktive' ? 'Ingen aktive mål ennå' : 'Ingen arkiverte mål'}
        </div>
      ) : (
        <div className="space-y-6">
          {gruppert.map(({ tema, maal: temaets_maal }) => {
            const erSammenfoldet = sammenfoldetTema.has(tema.id)

            return (
              <div key={tema.id}>
                {/* Temaoverskrift */}
                <button
                  onClick={() => toggleTema(tema.id)}
                  className="flex items-center gap-2 mb-2 group w-full text-left"
                >
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${erSammenfoldet ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {tema.navn}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {temaets_maal.length} mål
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {temaOppsummering(temaets_maal)}
                  </span>
                </button>

                {/* Mål */}
                {!erSammenfoldet && (
                  <div className="space-y-2 ml-1">
                    {temaets_maal.map(m => (
                      <MaalLinje key={m.id} maal={m} defaultOpen={alleUtvidet} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
