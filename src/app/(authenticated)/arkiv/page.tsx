'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PARTIER, type Stemme } from '@/lib/types'
import { hentArkiverteSaker, hentStortingsmandater, gjenopprettSak, type SakMedStemmer } from '@/lib/actions'
import { beregnFlertall, type Mandatfordeling, type PartiStemme as FlertallPartiStemme } from '@/lib/flertall'

const STEMME_STIL: Record<Stemme, { bg: string; text: string; label: string }> = {
  for: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'F' },
  mot: { bg: 'bg-red-100', text: 'text-red-700', label: 'M' },
  ukjent: { bg: 'bg-gray-50', text: 'text-gray-400', label: '–' },
}

function getStemme(sak: SakMedStemmer, parti: string): Stemme {
  const found = sak.partistemmer.find(s => s.parti === parti)
  return (found?.stemme as Stemme) || 'ukjent'
}

export default function ArkivPage() {
  const router = useRouter()
  const [saker, setSaker] = useState<SakMedStemmer[]>([])
  const [mandater, setMandater] = useState<Mandatfordeling[]>([])
  const [laster, setLaster] = useState(true)

  const lastData = useCallback(async () => {
    const [s, m] = await Promise.all([hentArkiverteSaker(), hentStortingsmandater()])
    setSaker(s)
    setMandater(m)
    setLaster(false)
  }, [])

  useEffect(() => { lastData() }, [lastData])

  async function handleGjenopprett(sakId: string) {
    await gjenopprettSak(sakId)
    lastData()
  }

  if (laster) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-gray-400">Laster...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F1923]">Arkiv</h1>
        <p className="text-sm text-gray-500">{saker.length} arkiverte saker</p>
      </div>

      {saker.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Ingen arkiverte saker</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[200px]">Sak</th>
                  {PARTIER.map(p => (
                    <th key={p} className="text-center px-1 py-3 font-medium text-gray-600 w-10">
                      <span className="text-xs">{p}</span>
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-medium text-gray-600 w-24">Flertall</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {saker.map(sak => {
                  const stemmerForBeregning: FlertallPartiStemme[] = PARTIER.map(p => ({
                    parti: p,
                    stemme: getStemme(sak, p),
                  }))
                  const flertall = mandater.length > 0 ? beregnFlertall(stemmerForBeregning, mandater) : null

                  return (
                    <tr key={sak.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/sak/${sak.id}`)}
                          className="font-medium text-[#0F1923] hover:text-[#4A9EDB] truncate max-w-[280px] text-left"
                        >
                          {sak.tittel}
                        </button>
                        {sak.arkivert_dato && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Arkivert {new Date(sak.arkivert_dato).toLocaleDateString('nb-NO')}
                          </div>
                        )}
                      </td>
                      {PARTIER.map(parti => {
                        const stemme = getStemme(sak, parti)
                        const stil = STEMME_STIL[stemme]
                        return (
                          <td key={parti} className="px-1 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium ${stil.bg} ${stil.text}`}>
                              {stil.label}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center">
                        {flertall ? (
                          <div className={`text-xs font-medium ${
                            flertall.harFlertall === 'for' ? 'text-emerald-600' :
                            flertall.harFlertall === 'mot' ? 'text-red-600' : 'text-gray-400'
                          }`}>
                            {flertall.forMandater}/{flertall.motMandater}
                          </div>
                        ) : '–'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleGjenopprett(sak.id)}
                          className="text-xs text-[#4A9EDB] hover:underline"
                        >
                          Gjenopprett
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
