'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { STANDARD_FASER } from '@/lib/types'
import type { SakMedStemmer } from '@/lib/actions'
import { usePavirkningssaker, useKomiteer, useInvaliderSakData } from '@/lib/queries'
import PavirkningTabell from '@/components/PavirkningTabell'
import SakModal from '@/components/SakModal'

type FaseFilter = 'Alle' | (typeof STANDARD_FASER)[number] | string

export default function PavirkningssakerSide() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [sok, setSok] = useState('')
  const [faseFilter, setFaseFilter] = useState<FaseFilter>('Alle')
  const [modalSak, setModalSak] = useState<SakMedStemmer | null | undefined>(undefined)

  const { invaliderSaker } = useInvaliderSakData()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  const { data: saker = [], isLoading } = usePavirkningssaker()
  const { data: komiteer = [] } = useKomiteer()

  const filtrerteSaker = saker.filter(sak => {
    if (sok) {
      const sokeord = sok.toLowerCase()
      if (!sak.tittel.toLowerCase().includes(sokeord) &&
          !(sak.beskrivelse ?? '').toLowerCase().includes(sokeord) &&
          !(sak.malsetting ?? '').toLowerCase().includes(sokeord)) {
        return false
      }
    }
    if (faseFilter !== 'Alle' && sak.fase !== faseFilter) return false
    return true
  })

  const aktiveFaser = Array.from(new Set(saker.map(s => s.fase).filter((f): f is string => !!f)))
  const faseAlternativer: string[] = ['Alle', ...STANDARD_FASER.filter(f => aktiveFaser.includes(f)), ...aktiveFaser.filter(f => !STANDARD_FASER.includes(f as typeof STANDARD_FASER[number]))]

  if (!user) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F1923]">Påvirkningssaker</h1>
          <p className="text-sm text-gray-500 mt-0.5">Saker under påvirkning som ikke enda er til behandling</p>
        </div>
        <button
          onClick={() => setModalSak(null)}
          className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ny påvirkningssak
        </button>
      </div>

      {/* Søk + fasefilter */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={sok}
            onChange={e => setSok(e.target.value)}
            placeholder="Søk i saker..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
          />
        </div>
        <div className="flex gap-1">
          {faseAlternativer.map(f => (
            <button
              key={f}
              onClick={() => setFaseFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                faseFilter === f
                  ? 'bg-[#0F1923] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tabell */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Laster saker...</div>
      ) : (
        <PavirkningTabell
          saker={filtrerteSaker}
          onKlikk={sak => router.push(`/sak/${sak.id}`)}
        />
      )}

      {/* Modal */}
      {modalSak !== undefined && (
        <SakModal
          sak={modalSak}
          komiteer={komiteer}
          defaultNiva="påvirkning"
          onLagret={(sakId) => {
            setModalSak(undefined)
            invaliderSaker()
            if (sakId) router.push(`/sak/${sakId}`)
          }}
          onLukk={() => setModalSak(undefined)}
        />
      )}
    </div>
  )
}
