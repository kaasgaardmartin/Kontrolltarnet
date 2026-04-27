'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useOffentligeHoringer, useArkiverteHoringer, useOrgBrukere, useInvaliderSakData } from '@/lib/queries'
import { arkiverHoring, gjenopprettHoring } from '@/lib/actions'
import type { OffentligHoring, OffentligHoringStatus } from '@/lib/actions'
import OffentligHoringModal from '@/components/OffentligHoringModal'

const STATUS_LABEL: Record<Exclude<OffentligHoringStatus, 'arkivert'>, string> = {
  innkommet: 'Innkommet',
  til_vurdering: 'Sendt til utvalg',
  svarer: 'Svarer',
  svarer_ikke: 'Svarer ikke',
  levert: 'Svart',
}

const STATUS_STIL: Record<Exclude<OffentligHoringStatus, 'arkivert'>, { bg: string; text: string; dot: string }> = {
  innkommet:    { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  til_vurdering:{ bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  svarer:       { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  svarer_ikke:  { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400' },
  levert:       { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
}

const ALLE_STATUSER: Exclude<OffentligHoringStatus, 'arkivert'>[] = ['innkommet', 'til_vurdering', 'svarer', 'svarer_ikke', 'levert']

// Departement-forkortelser
const DEP_FORKORTELSE: [string, string][] = [
  ['finansdep', 'FIN'],
  ['justis', 'JD'],
  ['nærings', 'NFD'],
  ['kommunal', 'KDD'],
  ['arbeids', 'AID'],
  ['helse', 'HOD'],
  ['kunnskap', 'KD'],
  ['utenriks', 'UD'],
  ['forsvar', 'FD'],
  ['samferdsel', 'SD'],
  ['klima', 'KLD'],
  ['olje', 'OED'],
  ['landbruk', 'LMD'],
  ['kultur', 'KUD'],
  ['barne', 'BFD'],
  ['digital', 'DFD'],
  ['statsminister', 'SMK'],
]

function kortDep(dep: string | null | undefined): string {
  if (!dep) return '—'
  const lower = dep.toLowerCase()
  for (const [key, abbr] of DEP_FORKORTELSE) {
    if (lower.includes(key)) return abbr
  }
  return dep.slice(0, 3).toUpperCase()
}

function formaterDato(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

type SortKolonne = 'publisert_dato' | 'horingsfrist' | 'intern_frist'

function FristChip({ dato }: { dato: string }) {
  const d = new Date(dato)
  const now = new Date()
  const dagerTil = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const datoTekst = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

  const passert = dagerTil < 0
  const snart = !passert && dagerTil <= 7

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      passert ? 'bg-gray-100 text-gray-400 line-through' :
      snart   ? 'bg-red-50 text-red-600' :
                'bg-blue-50 text-blue-700'
    }`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
      {datoTekst}
    </span>
  )
}

function erMottaker(instanser: string[] | null | undefined): boolean {
  if (!instanser) return false
  return instanser.some(i => /advokatforening/i.test(i))
}

function SortPil({ aktiv, retning }: { aktiv: boolean; retning: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 inline-flex flex-col gap-px ${aktiv ? 'text-[#4A9EDB]' : 'text-gray-300'}`}>
      <svg className={`w-2.5 h-2.5 ${aktiv && retning === 'asc' ? 'text-[#4A9EDB]' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${aktiv && retning === 'desc' ? 'text-[#4A9EDB]' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  )
}

export default function HoringerSide() {
  const { data: horinger = [], isLoading } = useOffentligeHoringer()
  const { data: arkiverteHoringer = [], isLoading: lasterArkiv } = useArkiverteHoringer()
  const { data: brukere = [] } = useOrgBrukere()
  const { invaliderOffentligeHoringer } = useInvaliderSakData()

  const [fane, setFane] = useState<'aktive' | 'arkiv'>('aktive')
  const [sok, setSok] = useState('')
  const [statusFilter, setStatusFilter] = useState<Exclude<OffentligHoringStatus, 'arkivert'> | 'alle'>('alle')
  const [utvalgFilter, setUtvalgFilter] = useState('')
  const [modalHoring, setModalHoring] = useState<OffentligHoring | null | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortKolonne | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [bekreftArkiverId, setBekreftArkiverId] = useState<string | null>(null)

  function toggleSort(kolonne: SortKolonne) {
    if (sortBy === kolonne) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortBy(null); setSortDir('asc') }
    } else {
      setSortBy(kolonne)
      setSortDir('asc')
    }
  }

  // Unique utvalg in data (flatMap since utvalg is string[])
  const utvalg = Array.from(new Set(
    horinger.flatMap(h => h.utvalg)
  )).filter(Boolean).sort()

  const filtrert = horinger.filter(h => {
    if (sok) {
      const s = sok.toLowerCase()
      if (!h.tittel.toLowerCase().includes(s) &&
          !(h.departement?.toLowerCase().includes(s)) &&
          !h.utvalg.some(u => u.toLowerCase().includes(s))) return false
    }
    if (statusFilter !== 'alle' && h.status !== statusFilter) return false
    if (utvalgFilter && !h.utvalg.includes(utvalgFilter)) return false
    return true
  })

  const sortert = sortBy
    ? [...filtrert].sort((a, b) => {
        const av = a[sortBy] ?? ''
        const bv = b[sortBy] ?? ''
        if (av === bv) return 0
        if (av === '') return 1
        if (bv === '') return -1
        return sortDir === 'asc'
          ? av < bv ? -1 : 1
          : av > bv ? -1 : 1
      })
    : filtrert

  async function handleArkiver(id: string) {
    await arkiverHoring(id)
    setBekreftArkiverId(null)
    invaliderOffentligeHoringer()
  }

  async function handleGjenopprett(id: string) {
    await gjenopprettHoring(id)
    invaliderOffentligeHoringer()
  }

  function eksporterExcel() {
    const wb = XLSX.utils.book_new()

    // Header-rad
    const header = ['Tittel', 'Departement', 'Status', 'Publisert', 'Høringsfrist', 'Intern frist', 'Utvalg', 'Lead-utvalg', 'HB eDocs', 'HS eDocs', 'Lenke']

    // Data-rader
    const rader = sortert.map(h => ({
      Tittel: h.tittel,
      Departement: h.departement ?? '',
      Status: STATUS_LABEL[h.status as Exclude<OffentligHoringStatus, 'arkivert'>] ?? h.status,
      Publisert: h.publisert_dato ?? '',
      Høringsfrist: h.horingsfrist ?? '',
      'Intern frist': h.intern_frist ?? '',
      Utvalg: h.utvalg.join(' | '),
      'Lead-utvalg': h.hoved_utvalg ?? '',
      'HB eDocs': h.horingsbrev_edocs ?? '',
      'HS eDocs': h.horingssvar_edocs ?? '',
      Lenke: h.regjeringen_url ?? '',
    }))

    const ws = XLSX.utils.json_to_sheet(rader, { header })

    // Kolonnebredder
    ws['!cols'] = [
      { wch: 60 }, // Tittel
      { wch: 14 }, // Departement
      { wch: 16 }, // Status
      { wch: 12 }, // Publisert
      { wch: 14 }, // Høringsfrist
      { wch: 13 }, // Intern frist
      { wch: 35 }, // Utvalg
      { wch: 25 }, // Lead-utvalg
      { wch: 11 }, // HB eDocs
      { wch: 11 }, // HS eDocs
      { wch: 55 }, // Lenke
    ]

    // Frys header-rad
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }

    // Klikkbare lenker i Lenke-kolonnen (kolonne K = index 10)
    sortert.forEach((h, i) => {
      if (!h.regjeringen_url) return
      const celle = XLSX.utils.encode_cell({ r: i + 1, c: 10 })
      ws[celle] = {
        v: 'regjeringen.no',
        t: 's',
        l: { Target: h.regjeringen_url },
      }
    })

    XLSX.utils.book_append_sheet(wb, ws, 'Høringer')
    XLSX.writeFile(wb, `horinger-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Count per status for badges
  const teller = ALLE_STATUSER.reduce((acc, s) => {
    acc[s] = horinger.filter(h => h.status === s).length
    return acc
  }, {} as Record<Exclude<OffentligHoringStatus, 'arkivert'>, number>)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F1923]">Høringer</h1>
          <p className="text-sm text-gray-500">
            {fane === 'aktive'
              ? `Offentlige høringer fra regjeringen.no${filtrert.length !== horinger.length ? ` — ${filtrert.length} av ${horinger.length} vist` : ''}`
              : `${arkiverteHoringer.length} arkiverte høringer`
            }
          </p>
        </div>
        {fane === 'aktive' && (
          <div className="flex items-center gap-2">
            {sortert.length > 0 && (
              <button
                onClick={eksporterExcel}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
                title="Eksporter til Excel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Eksporter
              </button>
            )}
            <button
              onClick={() => setModalHoring(null)}
              className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors"
            >
              + Legg til høring
            </button>
          </div>
        )}
      </div>

      {/* Fane-velger */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['aktive', 'arkiv'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFane(f)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              fane === f
                ? 'border-[#4A9EDB] text-[#4A9EDB]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'aktive' ? 'Aktive' : `Arkiv${arkiverteHoringer.length > 0 ? ` (${arkiverteHoringer.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Arkiv-fane */}
      {fane === 'arkiv' && (
        lasterArkiv ? (
          <div className="flex items-center justify-center py-16 text-gray-400 animate-pulse">Laster...</div>
        ) : arkiverteHoringer.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <p className="text-sm text-gray-400">Ingen arkiverte høringer</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Tittel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Dep.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Høringsfrist</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide w-28"></th>
                </tr>
              </thead>
              <tbody>
                {arkiverteHoringer.map((h, i) => (
                  <tr
                    key={h.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === arkiverteHoringer.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0F1923] leading-snug">{h.tittel}</div>
                      {h.regjeringen_url && (
                        <a
                          href={h.regjeringen_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-[#4A9EDB] hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          regjeringen.no
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {kortDep(h.departement)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {h.horingsfrist ? formaterDato(h.horingsfrist) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleGjenopprett(h.id)}
                        className="text-xs text-[#4A9EDB] hover:underline"
                      >
                        Gjenopprett
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {fane === 'aktive' && <>


      {/* Status-kort */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {ALLE_STATUSER.map(s => {
          const stil = STATUS_STIL[s]
          const aktiv = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(aktiv ? 'alle' : s)}
              className={`p-3 rounded-xl border text-left transition-all ${
                aktiv
                  ? 'border-[#4A9EDB] bg-[#4A9EDB]/5 ring-1 ring-[#4A9EDB]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${stil.dot}`} />
                <span className="text-xs text-gray-500">{STATUS_LABEL[s]}</span>
              </div>
              <span className="text-xl font-bold text-[#0F1923]">{teller[s]}</span>
            </button>
          )
        })}
      </div>

      {/* Filter-linje */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={sok}
            onChange={e => setSok(e.target.value)}
            placeholder="Søk i tittel, departement, utvalg..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
          />
        </div>
        {utvalg.length > 0 && (
          <select
            value={utvalgFilter}
            onChange={e => setUtvalgFilter(e.target.value)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors border ${
              utvalgFilter ? 'bg-[#0F1923] text-white border-[#0F1923]' : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            <option value="">Alle utvalg</option>
            {utvalg.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      </div>

      {/* Tabell */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 animate-pulse">Laster...</div>
      ) : filtrert.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            {horinger.length === 0 ? 'Ingen høringer registrert ennå' : 'Ingen høringer matcher filteret'}
          </p>
          {horinger.length === 0 && (
            <button
              onClick={() => setModalHoring(null)}
              className="mt-3 text-sm text-[#4A9EDB] hover:underline"
            >
              Legg til første høring
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Tittel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Dep.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Utvalg</th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort('publisert_dato')}
                >
                  <span className="inline-flex items-center">
                    Sendt
                    <SortPil aktiv={sortBy === 'publisert_dato'} retning={sortDir} />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort('horingsfrist')}
                >
                  <span className="inline-flex items-center">
                    Høringsfrist
                    <SortPil aktiv={sortBy === 'horingsfrist'} retning={sortDir} />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort('intern_frist')}
                >
                  <span className="inline-flex items-center">
                    Intern frist
                    <SortPil aktiv={sortBy === 'intern_frist'} retning={sortDir} />
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortert.map((h, i) => {
                const stil = STATUS_STIL[h.status as Exclude<OffentligHoringStatus, 'arkivert'>]
                return (
                  <tr
                    key={h.id}
                    onClick={() => setModalHoring(h)}
                    className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${i === sortert.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[#0F1923] leading-snug">{h.tittel}</span>
                        {erMottaker(h.horing_instanser) && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                            </svg>
                            Mottaker
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {h.departement && (
                          <span className="text-xs text-gray-400 md:hidden">{kortDep(h.departement)}</span>
                        )}
                        {h.regjeringen_url && (
                          <a
                            href={h.regjeringen_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-[#4A9EDB] hover:underline inline-flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.28" />
                            </svg>
                            regjeringen.no
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {kortDep(h.departement)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {h.utvalg.length > 0
                        ? <div className="flex flex-wrap gap-1">
                            {h.utvalg.map(u => {
                              const erLead = h.utvalg.length > 1 && h.hoved_utvalg === u
                              return (
                                <span
                                  key={u}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    erLead
                                      ? 'bg-indigo-600 text-white font-medium'
                                      : 'bg-indigo-50 text-indigo-700'
                                  }`}
                                >
                                  {erLead && (
                                    <svg className="w-2.5 h-2.5 text-yellow-300 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                    </svg>
                                  )}
                                  {u}
                                </span>
                              )
                            })}
                          </div>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {h.publisert_dato
                        ? formaterDato(h.publisert_dato)
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {h.horingsfrist
                        ? <FristChip dato={h.horingsfrist} />
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {h.intern_frist
                        ? <FristChip dato={h.intern_frist} />
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${stil.bg} ${stil.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stil.dot}`} />
                          {STATUS_LABEL[h.status as Exclude<OffentligHoringStatus, 'arkivert'>]}
                        </span>
                        {bekreftArkiverId === h.id ? (
                          <span className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-gray-500">Arkivere?</span>
                            <button onClick={() => handleArkiver(h.id)} className="text-xs text-white bg-gray-700 hover:bg-gray-900 px-2 py-0.5 rounded transition-colors">Ja</button>
                            <button onClick={() => setBekreftArkiverId(null)} className="text-xs text-gray-400 hover:text-gray-600">Nei</button>
                          </span>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setBekreftArkiverId(h.id) }}
                            className="text-xs text-gray-300 hover:text-gray-500 shrink-0 transition-colors"
                            title="Arkiver høring"
                          >
                            Arkiver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalHoring !== undefined && (
        <OffentligHoringModal
          horing={modalHoring}
          brukere={brukere}
          onLagret={() => {
            setModalHoring(undefined)
            invaliderOffentligeHoringer()
          }}
          onLukk={() => setModalHoring(undefined)}
        />
      )}
      </>}
    </div>
  )
}
