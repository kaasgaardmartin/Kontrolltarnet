'use client'

import { useState } from 'react'
import { leggTilNotat } from '@/lib/actions'

interface Notat {
  id: string
  tekst: string
  created_at: string
  brukere: { navn: string } | null
}

interface Props {
  sakId: string
  noter: Notat[]
  onOppdatert: () => void
  kanRedigere: boolean
}

function tidSiden(dato: string) {
  const diff = Date.now() - new Date(dato).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Nå'
  if (min < 60) return `${min} min siden`
  const timer = Math.floor(min / 60)
  if (timer < 24) return `${timer}t siden`
  const dager = Math.floor(timer / 24)
  if (dager < 7) return `${dager}d siden`
  return new Date(dato).toLocaleDateString('nb-NO')
}

export default function NotatSeksjon({ sakId, noter, onOppdatert, kanRedigere }: Props) {
  const [tekst, setTekst] = useState('')
  const [lagrer, setLagrer] = useState(false)

  async function handleLeggTil() {
    if (!tekst.trim()) return
    setLagrer(true)
    await leggTilNotat(sakId, tekst.trim())
    setTekst('')
    setLagrer(false)
    onOppdatert()
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#0F1923] mb-3">Noter</h3>

      {kanRedigere && (
        <div className="mb-4">
          <textarea
            value={tekst}
            onChange={e => setTekst(e.target.value)}
            rows={2}
            placeholder="Skriv et notat..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent resize-none"
          />
          <div className="flex justify-end mt-1">
            <button
              onClick={handleLeggTil}
              disabled={lagrer || !tekst.trim()}
              className="px-3 py-1.5 text-xs bg-[#4A9EDB] text-white rounded-md hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
            >
              {lagrer ? 'Lagrer...' : 'Legg til'}
            </button>
          </div>
        </div>
      )}

      {noter.length === 0 ? (
        <p className="text-xs text-gray-400">Ingen noter ennå</p>
      ) : (
        <div className="space-y-3">
          {noter.map(notat => (
            <div key={notat.id} className="border-l-2 border-gray-200 pl-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{notat.tekst}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{notat.brukere?.navn || 'Ukjent'}</span>
                <span className="text-xs text-gray-300">&middot;</span>
                <span className="text-xs text-gray-400">{tidSiden(notat.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
