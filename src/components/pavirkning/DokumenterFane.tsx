'use client'

import { useState } from 'react'
import type { MaalMedDetaljer } from '@/lib/pavirkning-types'
import type { LenkeType } from '@/lib/types'
import { useInvaliderPavirkning } from '@/lib/pavirkning-queries'
import { leggTilMaalLenke, slettMaalLenke } from '@/lib/pavirkning-actions'

interface Props {
  maal: MaalMedDetaljer
}

const LENKE_TYPER: { value: LenkeType; label: string }[] = [
  { value: 'offisiell', label: 'Offisiell' },
  { value: 'eget dokument', label: 'Eget dokument' },
  { value: 'media', label: 'Media' },
  { value: 'sosiale medier', label: 'Sosiale medier' },
]

export default function DokumenterFane({ maal }: Props) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const [visNy, setVisNy] = useState(false)

  async function handleSlett(lenkeId: string) {
    const res = await slettMaalLenke(lenkeId)
    if (res.success) invaliderMaal(maal.id)
  }

  return (
    <div className="space-y-3">
      {maal.lenker.length === 0 && !visNy && (
        <p className="text-sm text-gray-400 italic py-4 text-center">Ingen dokumenter lagt til ennå</p>
      )}

      {maal.lenker.map(l => (
        <div key={l.id} className="flex items-center gap-2 py-1.5 px-3 bg-white border border-gray-200 rounded-md group">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#4A9EDB] hover:underline flex-1 min-w-0 truncate"
          >
            {l.tittel}
          </a>
          <span className="text-xs text-gray-400 shrink-0">{LENKE_TYPER.find(t => t.value === l.type)?.label ?? l.type}</span>
          <button
            onClick={() => handleSlett(l.id)}
            className="text-gray-300 hover:text-[#BA0C2F] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Slett lenke"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {visNy ? (
        <NyLenkeSkjema
          maalId={maal.id}
          onLagret={() => {
            setVisNy(false)
            invaliderMaal(maal.id)
          }}
          onAvbryt={() => setVisNy(false)}
        />
      ) : (
        <button
          onClick={() => setVisNy(true)}
          className="text-sm text-[#4A9EDB] hover:text-[#3a8ecb]"
        >
          + Legg til dokument
        </button>
      )}
    </div>
  )
}

function NyLenkeSkjema({
  maalId,
  onLagret,
  onAvbryt,
}: {
  maalId: string
  onLagret: () => void
  onAvbryt: () => void
}) {
  const [tittel, setTittel] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<LenkeType>('offisiell')
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')

  async function handleLagre(e: React.FormEvent) {
    e.preventDefault()
    if (!tittel.trim()) { setFeil('Tittel er påkrevd'); return }
    if (!url.trim()) { setFeil('URL er påkrevd'); return }

    setLagrer(true)
    setFeil('')
    const res = await leggTilMaalLenke(maalId, tittel.trim(), url.trim(), type)

    if (res.success) {
      onLagret()
    } else {
      setFeil(res.error ?? 'Noe gikk galt')
      setLagrer(false)
    }
  }

  return (
    <form onSubmit={handleLagre} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Tittel <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={tittel}
          onChange={e => setTittel(e.target.value)}
          placeholder="Navn på dokumentet"
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          URL <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <select
          value={type}
          onChange={e => setType(e.target.value as LenkeType)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
        >
          {LENKE_TYPER.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {feil && <p className="text-xs text-red-600">{feil}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={lagrer || !tittel.trim() || !url.trim()}
          className="px-3 py-1.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
        >
          {lagrer ? 'Lagrer…' : 'Legg til'}
        </button>
        <button type="button" onClick={onAvbryt} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
          Avbryt
        </button>
      </div>
    </form>
  )
}
