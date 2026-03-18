'use client'

import { useState } from 'react'
import type { SakStakeholder, Stakeholder, StakeholderType, Holdning, Innflytelse } from '@/lib/types'
import {
  hentStakeholders,
  opprettStakeholder,
  leggTilSakStakeholder,
  oppdaterSakStakeholder,
  fjernSakStakeholder,
} from '@/lib/actions'

interface Props {
  sakId: string
  sakStakeholders: SakStakeholder[]
  onOppdatert: () => void
  kanRedigere: boolean
}

const HOLDNING_STIL: Record<string, { bg: string; text: string }> = {
  for: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  mot: { bg: 'bg-red-100', text: 'text-red-700' },
  'nøytral': { bg: 'bg-gray-100', text: 'text-gray-600' },
  ukjent: { bg: 'bg-gray-50', text: 'text-gray-400' },
}

const INNFLYTELSE_STIL: Record<string, { bg: string; text: string }> = {
  'høy': { bg: 'bg-purple-100', text: 'text-purple-700' },
  middels: { bg: 'bg-blue-100', text: 'text-blue-600' },
  lav: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

const TYPE_IKON: Record<string, string> = {
  organisasjon: 'O',
  politiker: 'P',
  enkeltperson: 'E',
  media: 'M',
  annet: '?',
}

export default function StakeholderSeksjon({ sakId, sakStakeholders, onOppdatert, kanRedigere }: Props) {
  const [visLeggTil, setVisLeggTil] = useState(false)
  const [redigerer, setRedigerer] = useState<string | null>(null)
  const [eksisterende, setEksisterende] = useState<Stakeholder[]>([])
  const [lasterEksisterende, setLasterEksisterende] = useState(false)

  // Form state for adding
  const [valgtStakeholder, setValgtStakeholder] = useState('')
  const [nyNavn, setNyNavn] = useState('')
  const [nyType, setNyType] = useState<StakeholderType>('organisasjon')
  const [nyKontaktinfo, setNyKontaktinfo] = useState('')
  const [holdning, setHoldning] = useState<Holdning>('ukjent')
  const [innflytelse, setInnflytelse] = useState<Innflytelse>('middels')
  const [notat, setNotat] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [opprettNy, setOpprettNy] = useState(false)

  // Edit form state
  const [editHoldning, setEditHoldning] = useState<Holdning>('ukjent')
  const [editInnflytelse, setEditInnflytelse] = useState<Innflytelse>('middels')
  const [editNotat, setEditNotat] = useState('')

  async function handleVisLeggTil() {
    setVisLeggTil(true)
    setLasterEksisterende(true)
    const data = await hentStakeholders()
    // Filter out already-added stakeholders
    const eksisterendeIds = sakStakeholders.map(ss => ss.stakeholder_id)
    setEksisterende(data.filter(s => !eksisterendeIds.includes(s.id)))
    setLasterEksisterende(false)
  }

  async function handleLeggTil() {
    setLagrer(true)

    let stakeholderId = valgtStakeholder

    // Create new stakeholder if needed
    if (opprettNy && nyNavn.trim()) {
      const result = await opprettStakeholder(nyNavn.trim(), nyType, nyKontaktinfo.trim() || null)
      if (!result.success || !result.id) {
        setLagrer(false)
        return
      }
      stakeholderId = result.id
    }

    if (!stakeholderId) {
      setLagrer(false)
      return
    }

    await leggTilSakStakeholder(sakId, stakeholderId, holdning, innflytelse, notat.trim() || null)

    // Reset
    setVisLeggTil(false)
    setValgtStakeholder('')
    setNyNavn('')
    setNyKontaktinfo('')
    setHoldning('ukjent')
    setInnflytelse('middels')
    setNotat('')
    setOpprettNy(false)
    setLagrer(false)
    onOppdatert()
  }

  async function handleOppdater(id: string) {
    setLagrer(true)
    await oppdaterSakStakeholder(id, editHoldning, editInnflytelse, editNotat.trim() || null)
    setRedigerer(null)
    setLagrer(false)
    onOppdatert()
  }

  async function handleFjern(id: string) {
    await fjernSakStakeholder(id)
    onOppdatert()
  }

  function startRediger(ss: SakStakeholder) {
    setRedigerer(ss.id)
    setEditHoldning(ss.holdning)
    setEditInnflytelse(ss.innflytelse)
    setEditNotat(ss.notat || '')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0F1923]">
          Stakeholders
          {sakStakeholders.length > 0 && (
            <span className="text-gray-400 font-normal ml-1">({sakStakeholders.length})</span>
          )}
        </h3>
        {kanRedigere && !visLeggTil && (
          <button
            onClick={handleVisLeggTil}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] transition-colors"
          >
            + Legg til
          </button>
        )}
      </div>

      {/* Existing stakeholders */}
      {sakStakeholders.length > 0 ? (
        <div className="space-y-2">
          {sakStakeholders.map(ss => {
            const sh = ss.stakeholders
            const holdningSt = HOLDNING_STIL[ss.holdning] || HOLDNING_STIL.ukjent
            const innflytelseSt = INNFLYTELSE_STIL[ss.innflytelse] || INNFLYTELSE_STIL.middels

            if (redigerer === ss.id) {
              return (
                <div key={ss.id} className="p-3 rounded-lg border border-[#4A9EDB] bg-blue-50/30 space-y-2">
                  <div className="text-sm font-medium text-[#0F1923]">{sh?.navn}</div>
                  <div className="flex gap-2">
                    <select
                      value={editHoldning}
                      onChange={e => setEditHoldning(e.target.value as Holdning)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                    >
                      <option value="for">For</option>
                      <option value="mot">Mot</option>
                      <option value="nøytral">Nøytral</option>
                      <option value="ukjent">Ukjent</option>
                    </select>
                    <select
                      value={editInnflytelse}
                      onChange={e => setEditInnflytelse(e.target.value as Innflytelse)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                    >
                      <option value="høy">Høy innflytelse</option>
                      <option value="middels">Middels</option>
                      <option value="lav">Lav</option>
                    </select>
                  </div>
                  <textarea
                    value={editNotat}
                    onChange={e => setEditNotat(e.target.value)}
                    rows={2}
                    placeholder="Notat..."
                    className="w-full text-xs px-2 py-1 border border-gray-300 rounded resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOppdater(ss.id)}
                      disabled={lagrer}
                      className="text-xs px-2 py-1 bg-[#4A9EDB] text-white rounded hover:bg-[#3a8ecb] disabled:opacity-50"
                    >
                      Lagre
                    </button>
                    <button
                      onClick={() => setRedigerer(null)}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={ss.id}
                className="group p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                      {TYPE_IKON[sh?.type || 'annet']}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-[#0F1923]">{sh?.navn}</div>
                      {sh?.kontaktinfo && (
                        <div className="text-xs text-gray-400">{sh.kontaktinfo}</div>
                      )}
                    </div>
                  </div>
                  {kanRedigere && (
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={() => startRediger(ss)}
                        className="text-xs text-gray-400 hover:text-[#4A9EDB]"
                      >
                        Rediger
                      </button>
                      <button
                        onClick={() => handleFjern(ss.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        Fjern
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${holdningSt.bg} ${holdningSt.text}`}>
                    {ss.holdning}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${innflytelseSt.bg} ${innflytelseSt.text}`}>
                    {ss.innflytelse}
                  </span>
                </div>
                {ss.notat && (
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{ss.notat}</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        !visLeggTil && (
          <p className="text-xs text-gray-400">Ingen stakeholders lagt til ennå.</p>
        )
      )}

      {/* Add form */}
      {visLeggTil && (
        <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-3">
          {lasterEksisterende ? (
            <div className="text-xs text-gray-400">Laster...</div>
          ) : (
            <>
              {!opprettNy ? (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Velg stakeholder</label>
                  <select
                    value={valgtStakeholder}
                    onChange={e => setValgtStakeholder(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    <option value="">Velg...</option>
                    {eksisterende.map(s => (
                      <option key={s.id} value={s.id}>{s.navn} ({s.type})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setOpprettNy(true)}
                    className="text-xs text-[#4A9EDB] hover:underline mt-1"
                  >
                    + Opprett ny stakeholder
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Navn *</label>
                    <input
                      type="text"
                      value={nyNavn}
                      onChange={e => setNyNavn(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
                      placeholder="Navn på stakeholder"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                      <select
                        value={nyType}
                        onChange={e => setNyType(e.target.value as StakeholderType)}
                        className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                      >
                        <option value="organisasjon">Organisasjon</option>
                        <option value="politiker">Politiker</option>
                        <option value="enkeltperson">Enkeltperson</option>
                        <option value="media">Media</option>
                        <option value="annet">Annet</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Kontaktinfo</label>
                      <input
                        type="text"
                        value={nyKontaktinfo}
                        onChange={e => setNyKontaktinfo(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded"
                        placeholder="Valgfritt"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpprettNy(false); setNyNavn('') }}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Velg eksisterende i stedet
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Holdning</label>
                  <select
                    value={holdning}
                    onChange={e => setHoldning(e.target.value as Holdning)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    <option value="for">For</option>
                    <option value="mot">Mot</option>
                    <option value="nøytral">Nøytral</option>
                    <option value="ukjent">Ukjent</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Innflytelse</label>
                  <select
                    value={innflytelse}
                    onChange={e => setInnflytelse(e.target.value as Innflytelse)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                  >
                    <option value="høy">Høy</option>
                    <option value="middels">Middels</option>
                    <option value="lav">Lav</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notat</label>
                <textarea
                  value={notat}
                  onChange={e => setNotat(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded resize-none"
                  placeholder="Hva mener de, hvorfor er de relevante..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleLeggTil}
                  disabled={lagrer || (!valgtStakeholder && !nyNavn.trim())}
                  className="text-xs px-3 py-1.5 bg-[#4A9EDB] text-white rounded hover:bg-[#3a8ecb] disabled:opacity-50"
                >
                  {lagrer ? 'Legger til...' : 'Legg til'}
                </button>
                <button
                  onClick={() => { setVisLeggTil(false); setOpprettNy(false) }}
                  className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
                >
                  Avbryt
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
