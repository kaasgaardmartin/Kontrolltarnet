'use client'

import { useState } from 'react'
import { leggTilLenke, slettLenke } from '@/lib/actions'
import type { LenkeType } from '@/lib/types'

interface Lenke {
  id: string
  tittel: string
  url: string
  type: LenkeType
  created_at: string
}

interface Props {
  sakId: string
  lenker: Lenke[]
  onOppdatert: () => void
  kanRedigere: boolean
}

const TYPE_STIL: Record<string, { bg: string; text: string }> = {
  offisiell: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'eget dokument': { bg: 'bg-purple-100', text: 'text-purple-700' },
  media: { bg: 'bg-orange-100', text: 'text-orange-700' },
  'sosiale medier': { bg: 'bg-pink-100', text: 'text-pink-700' },
}

const LENKE_TYPER: { value: LenkeType; label: string }[] = [
  { value: 'offisiell', label: 'Offisiell' },
  { value: 'eget dokument', label: 'Eget dokument' },
  { value: 'media', label: 'Media' },
  { value: 'sosiale medier', label: 'Sosiale medier' },
]

export default function LenkeSeksjon({ sakId, lenker, onOppdatert, kanRedigere }: Props) {
  const [visSkjema, setVisSkjema] = useState(false)
  const [tittel, setTittel] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<LenkeType>('offisiell')
  const [lagrer, setLagrer] = useState(false)

  async function handleLeggTil() {
    if (!tittel.trim() || !url.trim()) return
    setLagrer(true)
    await leggTilLenke(sakId, tittel.trim(), url.trim(), type)
    setTittel('')
    setUrl('')
    setType('offisiell')
    setVisSkjema(false)
    setLagrer(false)
    onOppdatert()
  }

  async function handleSlett(lenkeId: string) {
    await slettLenke(lenkeId)
    onOppdatert()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0F1923]">Lenker</h3>
        {kanRedigere && !visSkjema && (
          <button
            onClick={() => setVisSkjema(true)}
            className="text-xs text-[#4A9EDB] hover:underline"
          >
            + Legg til
          </button>
        )}
      </div>

      {visSkjema && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
          <input
            type="text"
            value={tittel}
            onChange={e => setTittel(e.target.value)}
            placeholder="Tittel"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
          />
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value as LenkeType)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent bg-white"
          >
            {LENKE_TYPER.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setVisSkjema(false)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Avbryt
            </button>
            <button
              onClick={handleLeggTil}
              disabled={lagrer || !tittel.trim() || !url.trim()}
              className="px-3 py-1 text-xs bg-[#4A9EDB] text-white rounded-md hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              {lagrer ? 'Lagrer...' : 'Legg til'}
            </button>
          </div>
        </div>
      )}

      {lenker.length === 0 ? (
        <p className="text-xs text-gray-400">Ingen lenker ennå</p>
      ) : (
        <div className="space-y-2">
          {lenker.map(lenke => {
            const stil = TYPE_STIL[lenke.type] || TYPE_STIL.offisiell
            return (
              <div key={lenke.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${stil.bg} ${stil.text} shrink-0`}>
                    {lenke.type}
                  </span>
                  <a
                    href={lenke.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#4A9EDB] hover:underline truncate"
                  >
                    {lenke.tittel}
                  </a>
                </div>
                {kanRedigere && (
                  <button
                    onClick={() => handleSlett(lenke.id)}
                    className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                  >
                    Fjern
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
