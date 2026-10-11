'use client'

import { useState } from 'react'
import type { MaalMedDetaljer, KildeType, GjennomslagVurdering } from '@/lib/pavirkning-types'
import { useInvaliderPavirkning } from '@/lib/pavirkning-queries'
import { opprettGjennomslag } from '@/lib/pavirkning-actions'

interface Props {
  maal: MaalMedDetaljer
}

const KILDE_TYPER: { value: KildeType; label: string }[] = [
  { value: 'innstilling', label: 'Innstilling' },
  { value: 'proposisjon', label: 'Proposisjon' },
  { value: 'vedtak', label: 'Vedtak' },
  { value: 'stortingsdebatt', label: 'Stortingsdebatt' },
  { value: 'horingssvar', label: 'Høringssvar' },
  { value: 'motereferat', label: 'Møtereferat' },
  { value: 'media', label: 'Media' },
]

const VURDERINGER: { value: GjennomslagVurdering; label: string; farge: string }[] = [
  { value: 'fullt', label: 'Fullt gjennomslag', farge: '#22c55e' },
  { value: 'delvis', label: 'Delvis', farge: '#eab308' },
  { value: 'bidrar', label: 'Bidrar', farge: '#4A9EDB' },
  { value: 'ikke', label: 'Ikke gjennomslag', farge: '#BA0C2F' },
]

export default function GjennomslagFane({ maal }: Props) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const [visNytt, setVisNytt] = useState(false)

  return (
    <div className="space-y-3">
      {maal.gjennomslag.length === 0 && !visNytt && (
        <p className="text-sm text-gray-400 italic py-4 text-center">Ingen gjennomslag registrert ennå</p>
      )}

      {maal.gjennomslag.map(g => (
        <div key={g.id} className="border border-gray-200 rounded-lg bg-white px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {new Date(g.dato).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{KILDE_TYPER.find(k => k.value === g.kilde_type)?.label ?? g.kilde_type}</span>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded ml-auto"
              style={{
                backgroundColor: (VURDERINGER.find(v => v.value === g.vurdering)?.farge ?? '#888') + '18',
                color: VURDERINGER.find(v => v.value === g.vurdering)?.farge ?? '#888',
              }}
            >
              {VURDERINGER.find(v => v.value === g.vurdering)?.label ?? g.vurdering}
            </span>
          </div>
          <p className="text-sm text-gray-800">{g.tekst}</p>
          {g.url && (
            <a
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#4A9EDB] hover:underline inline-block"
            >
              Kilde →
            </a>
          )}
        </div>
      ))}

      {visNytt ? (
        <NyttGjennomslagSkjema
          maalId={maal.id}
          nokkelresultater={maal.nokkelresultater}
          onLagret={() => {
            setVisNytt(false)
            invaliderMaal(maal.id)
          }}
          onAvbryt={() => setVisNytt(false)}
        />
      ) : (
        <button
          onClick={() => setVisNytt(true)}
          className="text-sm text-[#4A9EDB] hover:text-[#3a8ecb]"
        >
          + Registrer gjennomslag
        </button>
      )}
    </div>
  )
}

function NyttGjennomslagSkjema({
  maalId,
  nokkelresultater,
  onLagret,
  onAvbryt,
}: {
  maalId: string
  nokkelresultater: { id: string; tekst: string }[]
  onLagret: () => void
  onAvbryt: () => void
}) {
  const [dato, setDato] = useState(new Date().toISOString().slice(0, 10))
  const [kildeType, setKildeType] = useState<KildeType>('innstilling')
  const [tekst, setTekst] = useState('')
  const [vurdering, setVurdering] = useState<GjennomslagVurdering>('bidrar')
  const [url, setUrl] = useState('')
  const [krId, setKrId] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')

  async function handleLagre(e: React.FormEvent) {
    e.preventDefault()
    if (!tekst.trim()) { setFeil('Beskrivelse er påkrevd'); return }

    setLagrer(true)
    setFeil('')
    const res = await opprettGjennomslag({
      maal_id: maalId,
      nokkelresultat_id: krId || null,
      dato,
      kilde_type: kildeType,
      tekst: tekst.trim(),
      vurdering,
      url: url.trim() || null,
    })

    if (res.success) {
      onLagret()
    } else {
      setFeil(res.error ?? 'Noe gikk galt')
      setLagrer(false)
    }
  }

  return (
    <form onSubmit={handleLagre} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dato</label>
          <input
            type="date"
            value={dato}
            onChange={e => setDato(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kildetype</label>
          <select
            value={kildeType}
            onChange={e => setKildeType(e.target.value as KildeType)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            {KILDE_TYPER.map(k => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Beskrivelse <span className="text-red-500">*</span>
        </label>
        <textarea
          value={tekst}
          onChange={e => setTekst(e.target.value)}
          placeholder="Hva skjedde?"
          rows={2}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Vurdering</label>
        <div className="flex gap-2">
          {VURDERINGER.map(v => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVurdering(v.value)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                vurdering === v.value
                  ? 'border-current font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              style={vurdering === v.value ? { color: v.farge, borderColor: v.farge, backgroundColor: v.farge + '10' } : undefined}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {nokkelresultater.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Knyttet til nøkkelresultat</label>
          <select
            value={krId}
            onChange={e => setKrId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Generelt for målet</option>
            {nokkelresultater.map(kr => (
              <option key={kr.id} value={kr.id}>{kr.tekst}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Lenke til kilde</label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
      </div>

      {feil && <p className="text-xs text-red-600">{feil}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={lagrer || !tekst.trim()}
          className="px-3 py-1.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
        >
          {lagrer ? 'Lagrer…' : 'Registrer'}
        </button>
        <button type="button" onClick={onAvbryt} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
          Avbryt
        </button>
      </div>
    </form>
  )
}
