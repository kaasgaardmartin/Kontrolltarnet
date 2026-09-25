'use client'

import type { SakMedStemmer } from '@/lib/actions'
import { useState, Fragment } from 'react'

interface Props {
  saker: SakMedStemmer[]
  onKlikk: (sak: SakMedStemmer) => void
}

const FASE_FARGE: Record<string, { bg: string; text: string }> = {
  'Kartlegging': { bg: 'bg-slate-100', text: 'text-slate-700' },
  'Kontakt': { bg: 'bg-sky-100', text: 'text-sky-700' },
  'Forslag': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Innspill': { bg: 'bg-violet-100', text: 'text-violet-700' },
  'Politisk behandling': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
}

const LANDING_STIL: Record<string, { bg: string; text: string }> = {
  vedtas: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  faller: { bg: 'bg-red-100', text: 'text-red-700' },
  usikkert: { bg: 'bg-amber-100', text: 'text-amber-700' },
  ukjent: { bg: 'bg-gray-100', text: 'text-gray-500' },
  vedtatt: { bg: 'bg-blue-100', text: 'text-blue-700' },
}

function beregnDagerTil(dato: string): number {
  const d = new Date(dato)
  const idag = new Date()
  d.setHours(0, 0, 0, 0)
  idag.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
}

function fristFarge(dager: number): string {
  if (dager < 0) return 'text-red-600 font-medium'
  if (dager === 0) return 'text-orange-600 font-medium'
  if (dager <= 3) return 'text-amber-600'
  return 'text-gray-500'
}

function fristKortTekst(dager: number): string {
  if (dager < 0) return `${Math.abs(dager)}d siden`
  if (dager === 0) return 'i dag'
  if (dager === 1) return 'i morgen'
  return `om ${dager}d`
}

function SakRad({ sak, onKlikk, erDelsak }: { sak: SakMedStemmer; onKlikk: (sak: SakMedStemmer) => void; erDelsak?: boolean }) {
  const faseFarge = sak.fase ? (FASE_FARGE[sak.fase] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }) : null
  const landingStil = sak.landing ? LANDING_STIL[sak.landing] ?? LANDING_STIL['ukjent'] : LANDING_STIL['ukjent']
  const nesteFrist = sak.aktivitet_oppsummering?.nesteFrist
  const dager = nesteFrist ? beregnDagerTil(nesteFrist) : null

  return (
    <tr
      onClick={() => onKlikk(sak)}
      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${erDelsak ? 'bg-gray-50/50' : ''}`}
    >
      <td className="px-4 py-3">
        <div className={`${erDelsak ? 'pl-6' : ''}`}>
          <span className="text-sm font-medium text-[#0F1923]">
            {erDelsak && <span className="text-gray-400 mr-1">↳</span>}
            {sak.tittel}
          </span>
          {sak.malsetting && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{sak.malsetting}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {faseFarge && sak.fase ? (
          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${faseFarge.bg} ${faseFarge.text}`}>
            {sak.fase}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${landingStil.bg} ${landingStil.text}`}>
          {sak.landing ?? 'ukjent'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {(sak.stakeholder_navn ?? []).slice(0, 3).map((navn, i) => (
            <span key={i} className="inline-flex px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {navn}
            </span>
          ))}
          {(sak.stakeholder_navn ?? []).length > 3 && (
            <span className="text-xs text-gray-400">+{(sak.stakeholder_navn ?? []).length - 3}</span>
          )}
          {!(sak.stakeholder_navn ?? []).length && <span className="text-xs text-gray-400">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {nesteFrist && dager !== null ? (
          <span className={`text-xs ${fristFarge(dager)}`}>{fristKortTekst(dager)}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {(sak.aktivitet_oppsummering?.antallPlanlagte ?? 0) > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs bg-blue-100 text-blue-700 rounded-full">
            {sak.aktivitet_oppsummering!.antallPlanlagte}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  )
}

export default function PavirkningTabell({ saker, onKlikk }: Props) {
  const [ekspandert, setEkspandert] = useState<Set<string>>(new Set())

  function toggleEkspander(sakId: string) {
    setEkspandert(prev => {
      const ny = new Set(prev)
      if (ny.has(sakId)) ny.delete(sakId)
      else ny.add(sakId)
      return ny
    })
  }

  if (saker.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">Ingen påvirkningssaker enda.</p>
        <p className="text-xs mt-1">Opprett en ny sak for å komme i gang.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sak</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fase</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Landing</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stakeholdere</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Frist</th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aktiviteter</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {saker.map(sak => {
            const harDelsaker = (sak.delsaker ?? []).length > 0
            const erOpen = ekspandert.has(sak.id)
            return (
              <Fragment key={sak.id}>
                <tr className="group">
                  <td colSpan={6} className="p-0">
                    <table className="w-full">
                      <tbody>
                        <SakRad sak={sak} onKlikk={onKlikk} />
                      </tbody>
                    </table>
                    {harDelsaker && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleEkspander(sak.id) }}
                        className="ml-4 mb-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        {erOpen ? '▾' : '▸'} {sak.delsaker!.length} delsak{sak.delsaker!.length > 1 ? 'er' : ''}
                      </button>
                    )}
                  </td>
                </tr>
                {erOpen && sak.delsaker?.map(delsak => (
                  <SakRad key={delsak.id} sak={delsak} onKlikk={onKlikk} erDelsak />
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
