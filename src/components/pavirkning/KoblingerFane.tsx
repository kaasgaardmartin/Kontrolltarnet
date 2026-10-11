'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MaalMedDetaljer } from '@/lib/pavirkning-types'
import { useInvaliderPavirkning } from '@/lib/pavirkning-queries'
import { kobleSakTilMaal, kobleHoringTilMaal, fjernMaalKobling, sokSakerForKobling, sokHoringerForKobling } from '@/lib/pavirkning-actions'

interface Props {
  maal: MaalMedDetaljer
}

export default function KoblingerFane({ maal }: Props) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const [visSokSak, setVisSokSak] = useState(false)
  const [visSokHoring, setVisSokHoring] = useState(false)

  const sakKoblinger = maal.koblinger.filter(k => k.sak_id)
  const horingKoblinger = maal.koblinger.filter(k => k.offentlig_horing_id)

  async function handleFjern(koblingId: string) {
    const res = await fjernMaalKobling(koblingId)
    if (res.success) invaliderMaal(maal.id)
  }

  return (
    <div className="space-y-6">
      {/* Saker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Saker ({sakKoblinger.length})</h3>
          <button
            onClick={() => setVisSokSak(!visSokSak)}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb]"
          >
            {visSokSak ? 'Avbryt' : '+ Koble sak'}
          </button>
        </div>

        {visSokSak && (
          <SokSkjema
            type="sak"
            maalId={maal.id}
            onLagret={() => {
              setVisSokSak(false)
              invaliderMaal(maal.id)
            }}
          />
        )}

        {sakKoblinger.length === 0 && !visSokSak ? (
          <p className="text-xs text-gray-400 italic py-2">Ingen saker koblet til dette målet</p>
        ) : (
          <div className="space-y-1">
            {sakKoblinger.map(k => (
              <div key={k.id} className="flex items-center gap-2 py-1.5 px-3 bg-white border border-gray-200 rounded-md group">
                <Link
                  href={`/saker/${k.sak_id}`}
                  className="text-sm text-gray-800 hover:text-[#4A9EDB] flex-1 min-w-0 truncate"
                >
                  {k.saker?.tittel ?? 'Ukjent sak'}
                </Link>
                {k.saker?.landing && (
                  <span className="text-xs text-gray-400 shrink-0">{k.saker.landing}</span>
                )}
                {k.saker?.horingsfrist && (
                  <span className="text-xs text-gray-400 shrink-0">
                    Frist: {new Date(k.saker.horingsfrist).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => handleFjern(k.id)}
                  className="text-gray-300 hover:text-[#BA0C2F] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Fjern kobling"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Høringer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Høringer ({horingKoblinger.length})</h3>
          <button
            onClick={() => setVisSokHoring(!visSokHoring)}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb]"
          >
            {visSokHoring ? 'Avbryt' : '+ Koble høring'}
          </button>
        </div>

        {visSokHoring && (
          <SokSkjema
            type="horing"
            maalId={maal.id}
            onLagret={() => {
              setVisSokHoring(false)
              invaliderMaal(maal.id)
            }}
          />
        )}

        {horingKoblinger.length === 0 && !visSokHoring ? (
          <p className="text-xs text-gray-400 italic py-2">Ingen høringer koblet til dette målet</p>
        ) : (
          <div className="space-y-1">
            {horingKoblinger.map(k => (
              <div key={k.id} className="flex items-center gap-2 py-1.5 px-3 bg-white border border-gray-200 rounded-md group">
                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
                  {k.offentlige_horinger?.tittel ?? 'Ukjent høring'}
                </span>
                {k.offentlige_horinger?.horingsfrist && (
                  <span className="text-xs text-gray-400 shrink-0">
                    Frist: {new Date(k.offentlige_horinger.horingsfrist).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => handleFjern(k.id)}
                  className="text-gray-300 hover:text-[#BA0C2F] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Fjern kobling"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SokSkjema({ type, maalId, onLagret }: { type: 'sak' | 'horing'; maalId: string; onLagret: () => void }) {
  const [sok, setSok] = useState('')
  const [resultater, setResultater] = useState<{ id: string; tittel: string }[]>([])
  const [soker, setSoker] = useState(false)
  const [kobler, setKobler] = useState(false)

  async function handleSok() {
    if (!sok.trim()) return
    setSoker(true)
    const data = type === 'sak'
      ? await sokSakerForKobling(sok.trim())
      : await sokHoringerForKobling(sok.trim())
    setResultater(data)
    setSoker(false)
  }

  async function handleVelg(id: string) {
    setKobler(true)
    const res = type === 'sak'
      ? await kobleSakTilMaal(maalId, id)
      : await kobleHoringTilMaal(maalId, id)
    if (res.success) onLagret()
    setKobler(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 mb-3 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={sok}
          onChange={e => setSok(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSok()}
          placeholder={type === 'sak' ? 'Søk i saker…' : 'Søk i høringer…'}
          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          autoFocus
        />
        <button
          onClick={handleSok}
          disabled={soker || !sok.trim()}
          className="px-3 py-1.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
        >
          {soker ? 'Søker…' : 'Søk'}
        </button>
      </div>

      {resultater.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {resultater.map(r => (
            <button
              key={r.id}
              onClick={() => handleVelg(r.id)}
              disabled={kobler}
              className="w-full text-left text-sm text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {r.tittel}
            </button>
          ))}
        </div>
      )}

      {resultater.length === 0 && sok.trim() && !soker && (
        <p className="text-xs text-gray-400 italic">Ingen treff</p>
      )}
    </div>
  )
}
