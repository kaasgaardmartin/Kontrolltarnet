'use client'

import { useState } from 'react'
import { PARTIER, type Stemme } from '@/lib/types'
import { beregnFlertall, type Mandatfordeling, type PartiStemme as FlertallPartiStemme } from '@/lib/flertall'
import type { SakMedStemmer } from '@/lib/actions'

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

interface Props {
  saker: SakMedStemmer[]
  mandater: Mandatfordeling[]
  onKlikk: (sak: SakMedStemmer) => void
}

const STEMME_STIL: Record<Stemme, { bg: string; text: string; label: string }> = {
  for: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'F' },
  mot: { bg: 'bg-red-100', text: 'text-red-700', label: 'M' },
  ukjent: { bg: 'bg-gray-50', text: 'text-gray-400', label: '–' },
}

const LANDING_STIL: Record<string, { bg: string; text: string }> = {
  vedtas: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  faller: { bg: 'bg-red-100', text: 'text-red-700' },
  usikkert: { bg: 'bg-amber-100', text: 'text-amber-700' },
  ukjent: { bg: 'bg-gray-100', text: 'text-gray-500' },
  vedtatt: { bg: 'bg-blue-100', text: 'text-blue-700' },
}

const NIVA_LABEL: Record<string, string> = {
  storting: 'Storting',
  departement: 'Dept.',
  intern: 'Intern',
}

function getStemme(sak: SakMedStemmer, parti: string): Stemme {
  const found = sak.partistemmer.find(s => s.parti === parti)
  return (found?.stemme as Stemme) || 'ukjent'
}

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SaksRad({
  sak,
  mandater,
  onKlikk,
  erDelsak = false,
  delsakToggle,
}: {
  sak: SakMedStemmer
  mandater: Mandatfordeling[]
  onKlikk: (sak: SakMedStemmer) => void
  erDelsak?: boolean
  delsakToggle?: { utfoldet: boolean; antall: number; onToggle: () => void }
}) {
  const stemmerForBeregning: FlertallPartiStemme[] = PARTIER.map(p => ({
    parti: p,
    stemme: getStemme(sak, p),
  }))
  const flertall = mandater.length > 0
    ? beregnFlertall(stemmerForBeregning, mandater)
    : null

  const landing = sak.landing || 'ukjent'
  const landingStil = LANDING_STIL[landing] || LANDING_STIL.ukjent

  return (
    <tr
      onClick={() => onKlikk(sak)}
      className={`border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors ${
        erDelsak ? 'bg-gray-50/30' : ''
      }`}
    >
      <td className={`py-3 ${erDelsak ? 'pl-12 pr-4 border-l-3 border-l-[#4A9EDB]/40' : 'px-4'}`}>
        <div className="flex items-center gap-2">
          {delsakToggle ? (
            <button
              onClick={e => { e.stopPropagation(); delsakToggle.onToggle() }}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
              title={delsakToggle.utfoldet ? 'Skjul delsaker' : `Vis ${delsakToggle.antall} delsak${delsakToggle.antall > 1 ? 'er' : ''}`}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-150 ${delsakToggle.utfoldet ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ) : !erDelsak ? (
            <span className="shrink-0 w-5" />
          ) : null}
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-medium text-[#0F1923] truncate max-w-[280px] ${erDelsak ? 'text-[13px]' : ''}`}>
                {sak.tittel}
              </span>
              {delsakToggle && !delsakToggle.utfoldet && (
                <span className="text-xs text-gray-400 shrink-0">({delsakToggle.antall})</span>
              )}
            </div>
            {sak.stortingssak_ref && (
              <div className="text-xs mt-0.5">
                {sak.stortingssak_ref.startsWith('http') ? (
                  <a
                    href={sak.stortingssak_ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[#4A9EDB] hover:underline inline-flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.28" />
                    </svg>
                    {getDomainFromUrl(sak.stortingssak_ref)}
                  </a>
                ) : (
                  <span className="text-gray-400">{sak.stortingssak_ref}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-2 py-3">
        {sak.niva && (
          <span className="text-xs text-gray-500">{NIVA_LABEL[sak.niva] || sak.niva}</span>
        )}
      </td>
      <td className="px-2 py-3">
        {sak.utfall ? (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            sak.utfall === 'vedtatt'
              ? 'bg-emerald-200 text-emerald-800'
              : 'bg-red-200 text-red-800'
          }`}>
            {sak.utfall === 'vedtatt' ? 'Vedtatt' : 'Ikke vedtatt'}
          </span>
        ) : (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${landingStil.bg} ${landingStil.text}`}>
            {landing}
          </span>
        )}
      </td>
      {sak.niva !== 'storting' ? (
        <td colSpan={erDelsak ? PARTIER.length + 1 : 1} className="px-3 py-3">
          <div className="flex items-center gap-3 justify-center flex-wrap">
            {/* Neste frist */}
            {sak.aktivitet_oppsummering?.nesteFrist ? (() => {
              const dager = beregnDagerTil(sak.aktivitet_oppsummering.nesteFrist)
              const dato = new Date(sak.aktivitet_oppsummering.nesteFrist).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
              return (
                <span className={`inline-flex items-center gap-1 text-xs ${fristFarge(dager)}`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {dato} ({fristKortTekst(dager)})
                </span>
              )
            })() : null}
            {/* Antall oppgaver */}
            {sak.aktivitet_oppsummering && sak.aktivitet_oppsummering.antallPlanlagte > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {sak.aktivitet_oppsummering.antallPlanlagte} oppgave{sak.aktivitet_oppsummering.antallPlanlagte !== 1 ? 'r' : ''}
              </span>
            )}
            {/* Høringsfrist */}
            {sak.horingsfrist ? (() => {
              const dager = beregnDagerTil(sak.horingsfrist)
              const dato = new Date(sak.horingsfrist).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
              return (
                <span className={`inline-flex items-center gap-1 text-xs ${fristFarge(dager)}`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Høring {dato}
                </span>
              )
            })() : null}
            {/* Fallback hvis ingen data */}
            {!sak.aktivitet_oppsummering?.nesteFrist && !sak.horingsfrist && (!sak.aktivitet_oppsummering || sak.aktivitet_oppsummering.antallPlanlagte === 0) && (
              <span className="text-xs text-gray-300 italic">Ingen frister</span>
            )}
          </div>
        </td>
      ) : (
        <>
          {PARTIER.map(parti => {
            const stemme = getStemme(sak, parti)
            const stil = STEMME_STIL[stemme]
            return (
              <td key={parti} className="px-1 py-3 text-center">
                <span className={`inline-flex items-center justify-center ${erDelsak ? 'w-6 h-6' : 'w-7 h-7'} rounded text-xs font-medium ${stil.bg} ${stil.text}`}>
                  {stil.label}
                </span>
              </td>
            )
          })}
          <td className="px-3 py-3 text-center">
            {flertall ? (
              <div className={`text-xs font-medium ${
                flertall.harFlertall === 'for' ? 'text-emerald-600' :
                flertall.harFlertall === 'mot' ? 'text-red-600' :
                'text-gray-400'
              }`}>
                <span>{flertall.forMandater}</span>
                <span className="text-gray-300 mx-0.5">/</span>
                <span>{flertall.motMandater}</span>
                {flertall.ukjentMandater > 0 && (
                  <span className="text-gray-300 ml-1">({flertall.ukjentMandater}?)</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-300">–</span>
            )}
          </td>
        </>
      )}
    </tr>
  )
}

export default function Sakstabell({ saker, mandater, onKlikk }: Props) {
  if (saker.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9.75m3 0h3m-9-3.375h9.375a.375.375 0 0 0 .375-.375V3.375a.375.375 0 0 0-.375-.375H6.75a.375.375 0 0 0-.375.375v13.5c0 .207.168.375.375.375Z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600">Ingen aktive saker</p>
        <p className="text-xs text-gray-400 mt-1">Opprett en ny sak for å komme i gang</p>
      </div>
    )
  }

  const stortingssaker = saker.filter(s => s.niva === 'storting')
  const andreSaker = saker.filter(s => s.niva !== 'storting')

  return (
    <div className="space-y-6">
      {/* Stortingssaker */}
      {stortingssaker.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-[#0F1923]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21" />
            </svg>
            <h2 className="text-sm font-semibold text-[#0F1923]">
              Stortingssaker
              <span className="text-gray-400 font-normal ml-1">({stortingssaker.length})</span>
            </h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[200px]">Sak</th>
                    <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Nivå</th>
                    <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Landing</th>
                    {PARTIER.map(parti => (
                      <th key={parti} className="text-center px-1 py-3 font-medium text-gray-600 w-10">
                        <span className="text-xs">{parti}</span>
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-medium text-gray-600 w-24">Flertall</th>
                  </tr>
                </thead>
                <tbody>
                  {stortingssaker.map(sak => (
                    <SaksRadMedDelsaker key={sak.id} sak={sak} mandater={mandater} onKlikk={onKlikk} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Departement & interne saker */}
      {andreSaker.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-[#0F1923]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
            <h2 className="text-sm font-semibold text-[#0F1923]">
              Departement & interne saker
              <span className="text-gray-400 font-normal ml-1">({andreSaker.length})</span>
            </h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[200px]">Sak</th>
                    <th className="text-left px-2 py-3 font-medium text-gray-600 w-16">Nivå</th>
                    <th className="text-left px-2 py-3 font-medium text-gray-600 w-20">Landing</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">Frister & oppgaver</th>
                  </tr>
                </thead>
                <tbody>
                  {andreSaker.map(sak => (
                    <SaksRadMedDelsaker key={sak.id} sak={sak} mandater={mandater} onKlikk={onKlikk} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SaksRadMedDelsaker({
  sak,
  mandater,
  onKlikk,
}: {
  sak: SakMedStemmer
  mandater: Mandatfordeling[]
  onKlikk: (sak: SakMedStemmer) => void
}) {
  const [utfoldet, setUtfoldet] = useState(false)
  const harDelsaker = sak.delsaker && sak.delsaker.length > 0

  return (
    <>
      <SaksRad
        sak={sak}
        mandater={mandater}
        onKlikk={onKlikk}
        delsakToggle={harDelsaker ? {
          utfoldet,
          antall: sak.delsaker!.length,
          onToggle: () => setUtfoldet(prev => !prev),
        } : undefined}
      />
      {harDelsaker && utfoldet && sak.delsaker!.map(delsak => (
        <SaksRad key={delsak.id} sak={delsak} mandater={mandater} onKlikk={onKlikk} erDelsak />
      ))}
    </>
  )
}
