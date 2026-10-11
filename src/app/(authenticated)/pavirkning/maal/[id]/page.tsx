'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMaalDetaljer, useInvaliderPavirkning } from '@/lib/pavirkning-queries'
import { maalStatus, statusFarge } from '@/lib/pavirkning-regler'
import { arkiverMaal, gjenapneMaal } from '@/lib/pavirkning-actions'
import type { MaalUtfall } from '@/lib/pavirkning-types'
import NokkelresultatFane from '@/components/pavirkning/NokkelresultatFane'
import KoblingerFane from '@/components/pavirkning/KoblingerFane'
import GjennomslagFane from '@/components/pavirkning/GjennomslagFane'
import DokumenterFane from '@/components/pavirkning/DokumenterFane'

type Fane = 'nokkelresultater' | 'koblinger' | 'gjennomslag' | 'dokumenter'

export default function MaalSide() {
  const params = useParams()
  const router = useRouter()
  const maalId = params.id as string
  const { data: maal, isLoading } = useMaalDetaljer(maalId)
  const { invaliderMaal } = useInvaliderPavirkning()
  const [fane, setFane] = useState<Fane>('nokkelresultater')
  const [visArkiver, setVisArkiver] = useState(false)
  const [arkivUtfall, setArkivUtfall] = useState<MaalUtfall>('oppnadd')
  const [arkivOppsummering, setArkivOppsummering] = useState('')
  const [arkiverer, setArkiverer] = useState(false)

  if (isLoading) {
    return <div className="text-center py-12 text-sm text-gray-400">Laster mål…</div>
  }

  if (!maal) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">Mål ikke funnet</p>
        <Link href="/pavirkning" className="text-sm text-[#4A9EDB] mt-2 inline-block">Tilbake til oversikten</Link>
      </div>
    )
  }

  const status = maalStatus(maal.nokkelresultater)
  const farge = statusFarge(status)

  async function handleArkiver() {
    if (!arkivOppsummering.trim()) return
    setArkiverer(true)
    const res = await arkiverMaal(maalId, arkivUtfall, arkivOppsummering)
    if (res.success) {
      invaliderMaal(maalId)
      router.push('/pavirkning')
    }
    setArkiverer(false)
  }

  async function handleGjenapne() {
    const res = await gjenapneMaal(maalId)
    if (res.success) invaliderMaal(maalId)
  }

  const faner: { key: Fane; label: string; count: number }[] = [
    { key: 'nokkelresultater', label: 'Nøkkelresultater', count: maal.nokkelresultater.length },
    { key: 'koblinger', label: 'Saker og høringer', count: maal.koblinger.length },
    { key: 'gjennomslag', label: 'Gjennomslag', count: maal.gjennomslag.length },
    { key: 'dokumenter', label: 'Dokumenter', count: maal.lenker.length },
  ]

  return (
    <div className="space-y-6">
      {/* Tilbake + status */}
      <div className="flex items-center gap-3">
        <Link href="/pavirkning" className="text-sm text-gray-500 hover:text-[#4A9EDB]">
          ← Tilbake
        </Link>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: farge + '18', color: farge }}
        >
          {status}
        </span>
        {maal.tema && (
          <span className="text-xs text-gray-400">{maal.tema.navn}</span>
        )}
        {maal.status_tekst && (
          <span className="text-xs text-gray-500">· {maal.status_tekst}</span>
        )}
      </div>

      {/* Tittel og formulering */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{maal.tittel}</h1>
        {maal.formulering && (
          <p className="text-sm text-gray-600 mt-1">{maal.formulering}</p>
        )}
      </div>

      {/* Arkiver/Gjenåpne */}
      <div className="flex items-center gap-2">
        {!maal.arkivert ? (
          <button
            onClick={() => setVisArkiver(!visArkiver)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-2 py-1"
          >
            Avslutt og arkiver
          </button>
        ) : (
          <button
            onClick={handleGjenapne}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] border border-[#4A9EDB] rounded-md px-2 py-1"
          >
            Gjenåpne
          </button>
        )}
      </div>

      {/* Arkiveringsskjema */}
      {visArkiver && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utfall</label>
            <select
              value={arkivUtfall}
              onChange={e => setArkivUtfall(e.target.value as MaalUtfall)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value="oppnadd">Oppnådd</option>
              <option value="delvis">Delvis oppnådd</option>
              <option value="ikke">Ikke oppnådd</option>
              <option value="avbrutt">Avbrutt</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Oppsummering <span className="text-red-500">*</span>
            </label>
            <textarea
              value={arkivOppsummering}
              onChange={e => setArkivOppsummering(e.target.value)}
              placeholder="Hva lærte vi? Hva skjedde?"
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleArkiver}
              disabled={arkiverer || !arkivOppsummering.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-[#BA0C2F] text-white hover:bg-[#a00b29] disabled:opacity-50"
            >
              {arkiverer ? 'Arkiverer…' : 'Arkiver'}
            </button>
            <button onClick={() => setVisArkiver(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Statuslinje */}
      {maal.siste_kommentar && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-700">{maal.siste_kommentar}</p>
        </div>
      )}

      {maal.ventende_oppdatering && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-amber-700">
            Venter på bekreftelse i politisk kvarter
          </p>
          {maal.ventende_oppdatering.kommentar && (
            <p className="text-sm text-amber-800 mt-1">{maal.ventende_oppdatering.kommentar}</p>
          )}
        </div>
      )}

      {/* Faner */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {faner.map(f => (
            <button
              key={f.key}
              onClick={() => setFane(f.key)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                fane === f.key
                  ? 'border-[#4A9EDB] text-[#4A9EDB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Faneinnhold */}
      {fane === 'nokkelresultater' && <NokkelresultatFane maal={maal} />}
      {fane === 'koblinger' && <KoblingerFane maal={maal} />}
      {fane === 'gjennomslag' && <GjennomslagFane maal={maal} />}
      {fane === 'dokumenter' && <DokumenterFane maal={maal} />}
    </div>
  )
}
