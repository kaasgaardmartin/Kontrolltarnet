'use client'

import { useState } from 'react'
import { opprettSak, type SakFormData } from '@/lib/actions'
import { PARTIER } from '@/lib/types'

interface Props {
  forelderId: string
  forelderTittel: string
  onFerdig: () => void
  onLukk: () => void
}

export default function DelsakerSteg({ forelderId, forelderTittel, onFerdig, onLukk }: Props) {
  const [delsaker, setDelsaker] = useState<string[]>([''])
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')
  const [opprettet, setOpprettet] = useState(0)

  function leggTilRad() {
    setDelsaker(prev => [...prev, ''])
  }

  function oppdaterRad(index: number, verdi: string) {
    setDelsaker(prev => prev.map((d, i) => i === index ? verdi : d))
  }

  function fjernRad(index: number) {
    setDelsaker(prev => prev.filter((_, i) => i !== index))
  }

  // Enter i siste felt legger til ny rad
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (index === delsaker.length - 1) {
        leggTilRad()
      }
      // Fokuser neste felt etter render
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-delsak-input]')
        inputs[index + 1]?.focus()
      }, 50)
    }
  }

  const aktiveDelsaker = delsaker.filter(d => d.trim())

  async function handleOpprett() {
    if (aktiveDelsaker.length === 0) return

    setLagrer(true)
    setFeil('')
    setOpprettet(0)

    for (const tittel of aktiveDelsaker) {
      const formData: SakFormData = {
        tittel: tittel.trim(),
        beskrivelse: null,
        niva: null,
        landing: 'ukjent',
        komite_id: null,
        stortingssak_ref: null,
        sesjon: null,
        komite_dato: null,
        stortings_dato: null,
        forelder_id: forelderId,
        stemmer: PARTIER.map(p => ({ parti: p, stemme: 'ukjent' })),
      }

      const result = await opprettSak(formData)
      if (!result.success) {
        setFeil(`Feil ved oppretting av "${tittel}": ${result.error}`)
        setLagrer(false)
        return
      }
      setOpprettet(prev => prev + 1)
    }

    setLagrer(false)
    onFerdig()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onLukk} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F1923]">Saken er opprettet!</h2>
              <p className="text-xs text-gray-500 truncate max-w-[350px]">{forelderTittel}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 mb-4">
            Vil du legge til delsaker? Delsaker arver komité, datoer og referanse fra hovedsaken.
          </p>

          <div className="space-y-2 mb-3">
            {delsaker.map((delsak, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                <input
                  data-delsak-input
                  type="text"
                  value={delsak}
                  onChange={e => oppdaterRad(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, i)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  placeholder={i === 0 ? 'F.eks. "Romertall I — lovendringen"' : 'Tittel på delsak...'}
                  autoFocus={i === 0}
                />
                {delsaker.length > 1 && (
                  <button
                    onClick={() => fjernRad(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={leggTilRad}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] transition-colors"
          >
            + Legg til flere
          </button>

          {lagrer && (
            <div className="mt-3 flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-[#4A9EDB] rounded-full" />
              <span className="text-xs text-gray-500">
                Oppretter delsaker... ({opprettet}/{aktiveDelsaker.length})
              </span>
            </div>
          )}

          {feil && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {feil}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between rounded-b-xl">
          <button
            onClick={onLukk}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Hopp over
          </button>
          <button
            onClick={handleOpprett}
            disabled={lagrer || aktiveDelsaker.length === 0}
            className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
          >
            {lagrer
              ? 'Oppretter...'
              : aktiveDelsaker.length > 0
                ? `Opprett ${aktiveDelsaker.length} delsak${aktiveDelsaker.length > 1 ? 'er' : ''}`
                : 'Opprett delsaker'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
