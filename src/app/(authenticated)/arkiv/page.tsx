'use client'

import { useRouter } from 'next/navigation'
import { PARTIER, type Stemme } from '@/lib/types'
import { useState } from 'react'
import { gjenopprettSak, slettSak, type SakMedStemmer } from '@/lib/actions'
import { beregnFlertall, type PartiStemme as FlertallPartiStemme, type Mandatfordeling } from '@/lib/flertall'
import { useArkiverteSaker, useMandater, useInvaliderSakData } from '@/lib/queries'

const STEMME_STIL: Record<Stemme, { bg: string; text: string; label: string }> = {
  for: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'F' },
  mot: { bg: 'bg-red-100', text: 'text-red-700', label: 'M' },
  ukjent: { bg: 'bg-gray-50', text: 'text-gray-400', label: '–' },
}

function getStemme(sak: SakMedStemmer, parti: string): Stemme {
  const found = sak.partistemmer.find(s => s.parti === parti)
  return (found?.stemme as Stemme) || 'ukjent'
}

function ArkivRadGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function ArkivRad({
  sak,
  mandater,
  flertall,
  erDelsak = false,
  onGjenopprett,
  onSlett,
  bekreftSlett,
  onBekreftSlett,
  onAvbrytSlett,
  router,
}: {
  sak: SakMedStemmer
  mandater: Mandatfordeling[]
  flertall: ReturnType<typeof beregnFlertall> | null
  erDelsak?: boolean
  onGjenopprett?: () => void
  onSlett?: () => void
  bekreftSlett?: boolean
  onBekreftSlett?: () => void
  onAvbrytSlett?: () => void
  router: ReturnType<typeof useRouter>
}) {
  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${erDelsak ? 'bg-gray-50/30' : ''}`}>
      <td className={`py-3 ${erDelsak ? 'pl-12 pr-4 border-l-3 border-l-[#4A9EDB]/40' : 'px-4'}`}>
        <button
          onClick={() => router.push(`/sak/${sak.id}`)}
          className={`text-[#0F1923] hover:text-[#4A9EDB] truncate max-w-[280px] text-left ${erDelsak ? 'text-[13px]' : 'font-medium'}`}
        >
          {sak.tittel}
        </button>
        {!erDelsak && sak.arkivert_dato && (
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
        {!erDelsak && (
          <div className="flex items-center justify-end gap-3">
            {onGjenopprett && (
              <button onClick={onGjenopprett} className="text-xs text-[#4A9EDB] hover:underline">
                Gjenopprett
              </button>
            )}
            {bekreftSlett ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-red-600">Slette?</span>
                <button onClick={onSlett} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors">
                  Ja
                </button>
                <button onClick={onAvbrytSlett} className="text-xs text-gray-500 hover:text-gray-700">
                  Nei
                </button>
              </span>
            ) : (
              <button onClick={onBekreftSlett} className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors">
                Slett
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function ArkivPage() {
  const router = useRouter()
  const { data: saker = [], isLoading: lasterSaker } = useArkiverteSaker()
  const { data: mandater = [], isLoading: lasterMandater } = useMandater()
  const { invaliderSaker } = useInvaliderSakData()
  const [bekreftSlettId, setBekreftSlettId] = useState<string | null>(null)

  const laster = lasterSaker || lasterMandater

  async function handleGjenopprett(sakId: string) {
    await gjenopprettSak(sakId)
    invaliderSaker()
  }

  async function handleSlett(sakId: string) {
    await slettSak(sakId)
    setBekreftSlettId(null)
    invaliderSaker()
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
                    <ArkivRadGroup key={sak.id}>
                      <ArkivRad
                        sak={sak}
                        mandater={mandater}
                        flertall={flertall}
                        onGjenopprett={() => handleGjenopprett(sak.id)}
                        onSlett={() => handleSlett(sak.id)}
                        bekreftSlett={bekreftSlettId === sak.id}
                        onBekreftSlett={() => setBekreftSlettId(sak.id)}
                        onAvbrytSlett={() => setBekreftSlettId(null)}
                        router={router}
                      />
                      {sak.delsaker?.map(delsak => {
                        const delStemmer: FlertallPartiStemme[] = PARTIER.map(p => ({
                          parti: p,
                          stemme: getStemme(delsak, p),
                        }))
                        const delFlertall = mandater.length > 0 ? beregnFlertall(delStemmer, mandater) : null
                        return (
                          <ArkivRad
                            key={delsak.id}
                            sak={delsak}
                            mandater={mandater}
                            flertall={delFlertall}
                            erDelsak
                            router={router}
                          />
                        )
                      })}
                    </ArkivRadGroup>
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
