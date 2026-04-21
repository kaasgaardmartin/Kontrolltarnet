'use client'

import { useState } from 'react'
import { useOffentligeHoringer, useOrgBrukere, useInvaliderSakData } from '@/lib/queries'
import type { OffentligHoring, OffentligHoringStatus } from '@/lib/actions'
import OffentligHoringModal from '@/components/OffentligHoringModal'

const STATUS_LABEL: Record<OffentligHoringStatus, string> = {
  innkommet: 'Innkommet',
  til_vurdering: 'Til vurdering',
  svarer: 'Svarer',
  svarer_ikke: 'Svarer ikke',
  levert: 'Levert',
}

const STATUS_STIL: Record<OffentligHoringStatus, { bg: string; text: string; dot: string }> = {
  innkommet:    { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  til_vurdering:{ bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  svarer:       { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  svarer_ikke:  { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400' },
  levert:       { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
}

const ALLE_STATUSER: OffentligHoringStatus[] = ['innkommet', 'til_vurdering', 'svarer', 'svarer_ikke', 'levert']

function FristChip({ dato }: { dato: string }) {
  const d = new Date(dato)
  const now = new Date()
  const dagerTil = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

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
      {passert ? 'Frist passert' : dagerTil === 0 ? 'I dag' : dagerTil === 1 ? 'I morgen' : `${dagerTil}d`}
    </span>
  )
}

export default function HoringerSide() {
  const { data: horinger = [], isLoading } = useOffentligeHoringer()
  const { data: brukere = [] } = useOrgBrukere()
  const { invaliderOffentligeHoringer } = useInvaliderSakData()

  const [sok, setSok] = useState('')
  const [statusFilter, setStatusFilter] = useState<OffentligHoringStatus | 'alle'>('alle')
  const [utvalgFilter, setUtvalgFilter] = useState('')
  const [modalHoring, setModalHoring] = useState<OffentligHoring | null | undefined>(undefined)

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

  // Count per status for badges
  const teller = ALLE_STATUSER.reduce((acc, s) => {
    acc[s] = horinger.filter(h => h.status === s).length
    return acc
  }, {} as Record<OffentligHoringStatus, number>)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F1923]">Høringer</h1>
          <p className="text-sm text-gray-500">
            Offentlige høringer fra regjeringen.no
            {filtrert.length !== horinger.length && ` — ${filtrert.length} av ${horinger.length} vist`}
          </p>
        </div>
        <button
          onClick={() => setModalHoring(null)}
          className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors"
        >
          + Legg til høring
        </button>
      </div>

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
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Departement</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Utvalg</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Frist</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrert.map((h, i) => {
                const stil = STATUS_STIL[h.status]
                return (
                  <tr
                    key={h.id}
                    onClick={() => setModalHoring(h)}
                    className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${i === filtrert.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0F1923] leading-snug">{h.tittel}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {h.departement && (
                          <span className="text-xs text-gray-400 md:hidden">{h.departement}</span>
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
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {h.departement || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {h.utvalg.length > 0
                        ? <div className="flex flex-wrap gap-1">
                            {h.utvalg.map(u => (
                              <span key={u} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{u}</span>
                            ))}
                          </div>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {h.horingsfrist
                        ? <FristChip dato={h.horingsfrist} />
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${stil.bg} ${stil.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stil.dot}`} />
                        {STATUS_LABEL[h.status]}
                      </span>
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
    </div>
  )
}
