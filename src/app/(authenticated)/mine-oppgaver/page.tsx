'use client'

import { useRouter } from 'next/navigation'
import type { Aktivitet } from '@/lib/types'
import { oppdaterAktivitetStatus } from '@/lib/actions'
import type { AktivitetStatus } from '@/lib/types'
import { useMineAktiviteter, useInvaliderSakData } from '@/lib/queries'
import { useState } from 'react'

type AktivitetMedSak = Aktivitet & { saker: { id: string; tittel: string } | null }

const TYPE_FARGE: Record<string, { bg: string; text: string }> = {
  'møte': { bg: 'bg-blue-100', text: 'text-blue-700' },
  telefon: { bg: 'bg-green-100', text: 'text-green-700' },
  'e-post': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'sosiale medier': { bg: 'bg-pink-100', text: 'text-pink-700' },
  publisering: { bg: 'bg-orange-100', text: 'text-orange-700' },
  annet: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

function fristInfo(frist: string | null): { text: string; className: string; prioritet: number } {
  if (!frist) return { text: '', className: 'text-gray-400', prioritet: 999 }
  const dato = new Date(frist)
  const idag = new Date()
  idag.setHours(0, 0, 0, 0)
  const diff = dato.getTime() - idag.getTime()
  const dager = Math.ceil(diff / (1000 * 60 * 60 * 24))

  const formatted = dato.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })

  if (dager < 0) return { text: `${formatted} — forfalt`, className: 'text-red-600 font-medium', prioritet: -1 }
  if (dager === 0) return { text: `${formatted} — i dag`, className: 'text-orange-600 font-medium', prioritet: 0 }
  if (dager === 1) return { text: `${formatted} — i morgen`, className: 'text-orange-500', prioritet: 1 }
  if (dager <= 7) return { text: `${formatted} — om ${dager} dager`, className: 'text-yellow-600', prioritet: dager }
  return { text: formatted, className: 'text-gray-500', prioritet: dager }
}

export default function MineOppgaverSide() {
  const router = useRouter()
  const { data: aktiviteter = [], isLoading: laster } = useMineAktiviteter()
  const { invaliderSaker } = useInvaliderSakData()
  const [filter, setFilter] = useState<'alle' | 'planlagt' | 'utført'>('planlagt')

  async function handleStatusEndring(id: string, status: AktivitetStatus) {
    await oppdaterAktivitetStatus(id, status)
    invaliderSaker()
  }

  if (laster) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-gray-400">Laster...</div>
      </div>
    )
  }

  const planlagte = aktiviteter.filter(a => a.status === 'planlagt')
  const utforte = aktiviteter.filter(a => a.status === 'utført')
  const avlyste = aktiviteter.filter(a => a.status === 'avlyst')

  const viste = filter === 'planlagt' ? planlagte
    : filter === 'utført' ? [...utforte, ...avlyste]
    : aktiviteter

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F1923]">Mine oppgaver</h1>
          <p className="text-sm text-gray-500">
            {planlagte.length} aktive oppgaver
            {utforte.length > 0 && ` · ${utforte.length} fullført`}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'planlagt' as const, label: 'Aktive', count: planlagte.length },
          { key: 'utført' as const, label: 'Fullført', count: utforte.length + avlyste.length },
          { key: 'alle' as const, label: 'Alle', count: aktiviteter.length },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.key
                ? 'bg-[#0F1923] text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Task list */}
      {viste.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">
            {filter === 'planlagt' ? 'Ingen aktive oppgaver' : 'Ingen oppgaver'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Oppgaver tildelt deg vises her
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {viste.map(a => {
              const typeFarge = TYPE_FARGE[a.type] || TYPE_FARGE.annet
              const frist = fristInfo(a.frist)
              const erAktiv = a.status === 'planlagt'

              return (
                <div
                  key={a.id}
                  className={`group flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors ${
                    !erAktiv ? 'opacity-50' : ''
                  }`}
                >
                  {/* Checkbox */}
                  {erAktiv ? (
                    <button
                      onClick={() => handleStatusEndring(a.id, 'utført')}
                      className="mt-1 w-5 h-5 rounded border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 shrink-0 transition-colors"
                      title="Merk som utført"
                    />
                  ) : (
                    <button
                      onClick={() => handleStatusEndring(a.id, 'planlagt')}
                      className="mt-1 w-5 h-5 rounded border-2 border-emerald-400 bg-emerald-100 shrink-0 flex items-center justify-center transition-colors hover:bg-yellow-100 hover:border-yellow-400"
                      title="Sett tilbake til aktiv"
                    >
                      <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${typeFarge.bg} ${typeFarge.text}`}>
                        {a.type}
                      </span>
                      {a.stakeholders && (
                        <span className="text-xs text-gray-400">→ {a.stakeholders.navn}</span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${erAktiv ? 'text-[#0F1923]' : 'text-gray-400 line-through'}`}>
                      {a.beskrivelse}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {a.frist && (
                        <span className={`text-xs ${erAktiv ? frist.className : 'text-gray-400'}`}>
                          {frist.text}
                        </span>
                      )}
                      {a.saker && (
                        <button
                          onClick={() => router.push(`/sak/${a.saker!.id}`)}
                          className="text-xs text-[#4A9EDB] hover:underline"
                        >
                          {a.saker.tittel}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {erAktiv && (
                    <div className="hidden group-hover:flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStatusEndring(a.id, 'avlyst')}
                        className="text-xs text-gray-400 hover:text-amber-600"
                      >
                        Avlys
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
