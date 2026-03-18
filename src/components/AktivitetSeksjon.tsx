'use client'

import { useState } from 'react'
import type { Aktivitet, AktivitetType, AktivitetStatus, SakStakeholder, Bruker } from '@/lib/types'
import { opprettAktivitet, oppdaterAktivitetStatus, oppdaterAktivitetAnsvarlig, slettAktivitet } from '@/lib/actions'

interface Props {
  sakId: string
  aktiviteter: Aktivitet[]
  sakStakeholders: SakStakeholder[]
  brukere: { id: string; navn: string }[]
  onOppdatert: () => void
  kanRedigere: boolean
}

const TYPE_IKON: Record<string, string> = {
  'møte': 'M',
  telefon: 'T',
  'e-post': 'E',
  'sosiale medier': 'S',
  publisering: 'P',
  annet: '?',
}

const TYPE_FARGE: Record<string, { bg: string; text: string }> = {
  'møte': { bg: 'bg-blue-100', text: 'text-blue-700' },
  telefon: { bg: 'bg-green-100', text: 'text-green-700' },
  'e-post': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'sosiale medier': { bg: 'bg-pink-100', text: 'text-pink-700' },
  publisering: { bg: 'bg-orange-100', text: 'text-orange-700' },
  annet: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

const STATUS_STIL: Record<string, { bg: string; text: string }> = {
  planlagt: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'utført': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  avlyst: { bg: 'bg-gray-100', text: 'text-gray-400 line-through' },
}

function fristLabel(frist: string | null): { text: string; className: string } {
  if (!frist) return { text: 'Ingen frist', className: 'text-gray-400' }
  const dato = new Date(frist)
  const idag = new Date()
  idag.setHours(0, 0, 0, 0)
  const diff = dato.getTime() - idag.getTime()
  const dager = Math.ceil(diff / (1000 * 60 * 60 * 24))

  const formatted = dato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })

  if (dager < 0) return { text: `${formatted} (forfalt)`, className: 'text-red-600 font-medium' }
  if (dager === 0) return { text: `${formatted} (i dag)`, className: 'text-orange-600 font-medium' }
  if (dager <= 3) return { text: `${formatted} (${dager}d)`, className: 'text-orange-500' }
  return { text: formatted, className: 'text-gray-500' }
}

export default function AktivitetSeksjon({ sakId, aktiviteter, sakStakeholders, brukere, onOppdatert, kanRedigere }: Props) {
  const [visLeggTil, setVisLeggTil] = useState(false)
  const [type, setType] = useState<AktivitetType>('annet')
  const [beskrivelse, setBeskrivelse] = useState('')
  const [frist, setFrist] = useState('')
  const [stakeholderId, setStakeholderId] = useState('')
  const [ansvarligId, setAnsvarligId] = useState('')
  const [lagrer, setLagrer] = useState(false)

  const planlagte = aktiviteter.filter(a => a.status === 'planlagt')
  const fullforte = aktiviteter.filter(a => a.status !== 'planlagt')

  async function handleLeggTil() {
    if (!beskrivelse.trim()) return
    setLagrer(true)
    await opprettAktivitet(sakId, {
      type,
      beskrivelse: beskrivelse.trim(),
      frist: frist || null,
      stakeholder_id: stakeholderId || null,
      ansvarlig_id: ansvarligId || null,
    })
    setBeskrivelse('')
    setFrist('')
    setStakeholderId('')
    setAnsvarligId('')
    setType('annet')
    setVisLeggTil(false)
    setLagrer(false)
    onOppdatert()
  }

  async function handleStatusEndring(aktivitetId: string, nyStatus: AktivitetStatus) {
    await oppdaterAktivitetStatus(aktivitetId, nyStatus)
    onOppdatert()
  }

  async function handleAnsvarligEndring(aktivitetId: string, nyAnsvarligId: string) {
    await oppdaterAktivitetAnsvarlig(aktivitetId, nyAnsvarligId || null)
    onOppdatert()
  }

  async function handleSlett(aktivitetId: string) {
    await slettAktivitet(aktivitetId)
    onOppdatert()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0F1923]">
          Oppfølging
          {planlagte.length > 0 && (
            <span className="text-gray-400 font-normal ml-1">({planlagte.length} aktive)</span>
          )}
        </h3>
        {kanRedigere && !visLeggTil && (
          <button
            onClick={() => setVisLeggTil(true)}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] transition-colors"
          >
            + Ny aktivitet
          </button>
        )}
      </div>

      {/* Add form */}
      {visLeggTil && (
        <div className="mb-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as AktivitetType)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
              >
                <option value="møte">Møte</option>
                <option value="telefon">Telefon</option>
                <option value="e-post">E-post</option>
                <option value="sosiale medier">Sosiale medier</option>
                <option value="publisering">Publisering</option>
                <option value="annet">Annet</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Frist</label>
              <input
                type="date"
                value={frist}
                onChange={e => setFrist(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Beskrivelse *</label>
            <input
              type="text"
              value={beskrivelse}
              onChange={e => setBeskrivelse(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
              placeholder="Hva skal gjøres?"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            {sakStakeholders.length > 0 && (
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Stakeholder</label>
                <select
                  value={stakeholderId}
                  onChange={e => setStakeholderId(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                >
                  <option value="">Ingen</option>
                  {sakStakeholders.map(ss => (
                    <option key={ss.stakeholder_id} value={ss.stakeholder_id}>
                      {ss.stakeholders?.navn}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ansvarlig</label>
              <select
                value={ansvarligId}
                onChange={e => setAnsvarligId(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
              >
                <option value="">Ingen</option>
                {brukere.map(b => (
                  <option key={b.id} value={b.id}>{b.navn}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleLeggTil}
              disabled={lagrer || !beskrivelse.trim()}
              className="text-xs px-3 py-1.5 bg-[#4A9EDB] text-white rounded hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              {lagrer ? 'Legger til...' : 'Legg til'}
            </button>
            <button
              onClick={() => setVisLeggTil(false)}
              className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Planned activities */}
      {planlagte.length > 0 ? (
        <div className="space-y-1.5">
          {planlagte.map(a => {
            const typeFarge = TYPE_FARGE[a.type] || TYPE_FARGE.annet
            const fristInfo = fristLabel(a.frist)

            return (
              <div
                key={a.id}
                className="group flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {kanRedigere && (
                  <button
                    onClick={() => handleStatusEndring(a.id, 'utført')}
                    className="mt-0.5 w-4 h-4 rounded border border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 shrink-0 transition-colors"
                    title="Merk som utført"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${typeFarge.bg} ${typeFarge.text}`}>
                      {TYPE_IKON[a.type]}{' '}{a.type}
                    </span>
                    {a.stakeholders && (
                      <span className="text-xs text-gray-400">→ {a.stakeholders.navn}</span>
                    )}
                  </div>
                  <p className="text-sm text-[#0F1923] mt-0.5">{a.beskrivelse}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs ${fristInfo.className}`}>{fristInfo.text}</span>
                    {kanRedigere ? (
                      <select
                        value={a.ansvarlig_id || ''}
                        onChange={e => handleAnsvarligEndring(a.id, e.target.value)}
                        className="text-xs px-1 py-0.5 border border-transparent hover:border-gray-200 rounded bg-transparent cursor-pointer text-gray-400 hover:text-gray-600"
                      >
                        <option value="">Ikke tildelt</option>
                        {brukere.map(b => (
                          <option key={b.id} value={b.id}>{b.navn}</option>
                        ))}
                      </select>
                    ) : (
                      a.brukere && (
                        <span className="text-xs text-gray-400">• {a.brukere.navn}</span>
                      )
                    )}
                  </div>
                </div>
                {kanRedigere && (
                  <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStatusEndring(a.id, 'avlyst')}
                      className="text-xs text-gray-400 hover:text-amber-600"
                      title="Avlys"
                    >
                      Avlys
                    </button>
                    <button
                      onClick={() => handleSlett(a.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                      title="Slett"
                    >
                      Slett
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        !visLeggTil && (
          <p className="text-xs text-gray-400">Ingen planlagte oppfølgingspunkter.</p>
        )
      )}

      {/* Completed/cancelled */}
      {fullforte.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            {fullforte.length} fullførte/avlyste
          </summary>
          <div className="space-y-1 mt-2">
            {fullforte.map(a => {
              const statusSt = STATUS_STIL[a.status] || STATUS_STIL.planlagt
              const typeFarge = TYPE_FARGE[a.type] || TYPE_FARGE.annet

              return (
                <div key={a.id} className="group flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 transition-colors">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusSt.bg} ${statusSt.text}`}>
                    {a.status}
                  </span>
                  <span className={`text-xs px-1 rounded ${typeFarge.bg} ${typeFarge.text}`}>
                    {TYPE_IKON[a.type]}
                  </span>
                  <span className={`text-xs flex-1 ${a.status === 'avlyst' ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                    {a.beskrivelse}
                  </span>
                  {kanRedigere && (
                    <button
                      onClick={() => handleStatusEndring(a.id, 'planlagt')}
                      className="hidden group-hover:inline text-xs text-gray-400 hover:text-[#4A9EDB] shrink-0"
                      title="Sett tilbake til planlagt"
                    >
                      Angre
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
