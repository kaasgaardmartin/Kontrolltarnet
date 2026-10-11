'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MaalMedDetaljer, NokkelresultatMedTiltak } from '@/lib/pavirkning-types'
import { maalStatus, krStatus, statusFarge, krVerdi, tiltakForfaller, tiltakPassertFrist } from '@/lib/pavirkning-regler'

interface Props {
  maal: MaalMedDetaljer
  defaultOpen?: boolean
}

export default function MaalLinje({ maal, defaultOpen = false }: Props) {
  const [aapen, setAapen] = useState(defaultOpen)
  const status = maalStatus(maal.nokkelresultater)
  const farge = statusFarge(status)

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Mållinje */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setAapen(!aapen)}
          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          aria-label={aapen ? 'Fold sammen' : 'Fold ut'}
        >
          <svg className={`w-4 h-4 transition-transform ${aapen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <Link
            href={`/pavirkning/maal/${maal.id}`}
            className="text-sm font-semibold text-gray-900 hover:text-[#4A9EDB] transition-colors"
          >
            {maal.tittel}
          </Link>
          {maal.status_tekst && (
            <p className="text-xs text-gray-500 mt-0.5">{maal.status_tekst}</p>
          )}
        </div>

        {/* KR-prikker */}
        <div className="flex items-center gap-1 shrink-0">
          {maal.nokkelresultater.map(kr => (
            <span
              key={kr.id}
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: statusFarge(krStatus(kr)) }}
              title={`${kr.tekst}: ${krStatus(kr)}`}
            />
          ))}
        </div>

        {/* Statusetikett */}
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: farge + '18', color: farge }}
        >
          {status}
        </span>
      </div>

      {/* Utfoldet: nøkkelresultater */}
      {aapen && (
        <div className="border-t border-gray-100 px-4 py-2 space-y-1">
          {maal.nokkelresultater.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 italic">Ingen nøkkelresultater ennå</p>
          ) : (
            maal.nokkelresultater.map(kr => (
              <KRLinje key={kr.id} kr={kr} maalId={maal.id} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function KRLinje({ kr, maalId }: { kr: NokkelresultatMedTiltak; maalId: string }) {
  const [visTiltak, setVisTiltak] = useState(false)
  const status = krStatus(kr)
  const farge = statusFarge(status)
  const verdi = krVerdi(kr)
  const aapneTiltak = kr.tiltak.filter(t => t.status === 'planlagt')
  const gjorteTiltak = kr.tiltak.filter(t => t.status === 'utført')
  const droppedeTiltak = kr.tiltak.filter(t => t.status === 'avlyst')

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        {aapneTiltak.length > 0 && (
          <button
            onClick={() => setVisTiltak(!visTiltak)}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${visTiltak ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {aapneTiltak.length === 0 && <span className="w-3.5" />}

        <Link
          href={`/pavirkning/maal/${maalId}?kr=${kr.id}`}
          className="text-sm text-gray-700 hover:text-[#4A9EDB] flex-1 min-w-0 truncate"
        >
          {kr.tekst}
        </Link>

        {aapneTiltak.length > 0 && (
          <span className="text-xs text-gray-400 shrink-0">{aapneTiltak.length} tiltak</span>
        )}

        {/* Fremdriftslinje */}
        <div className="w-16 h-1.5 bg-gray-100 rounded-full shrink-0 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${kr.oppnadd ? 100 : Math.max(10, kr.sannsynlighet * 10)}%`,
              backgroundColor: farge,
            }}
          />
        </div>

        <span className="text-xs text-gray-500 shrink-0 w-14 text-right">{verdi}</span>
      </div>

      {/* Tiltak */}
      {visTiltak && (
        <div className="ml-8 mt-1 space-y-0.5">
          {aapneTiltak.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
              <Link
                href={`/pavirkning/maal/${maalId}?tiltak=${t.id}`}
                className="flex-1 min-w-0 truncate hover:text-[#4A9EDB]"
              >
                {t.beskrivelse}
              </Link>
              {t.brukere?.navn && (
                <span className="text-gray-400 shrink-0">{t.brukere.navn}</span>
              )}
              {t.frist && (
                <span className={`shrink-0 ${tiltakPassertFrist(t) ? 'text-[#BA0C2F] font-medium' : 'text-gray-400'}`}>
                  {tiltakPassertFrist(t) ? 'forfalt' : new Date(t.frist).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>
          ))}
          {aapneTiltak.length === 0 && (
            <p className="text-xs text-gray-400 italic py-1">Ingen åpne tiltak</p>
          )}
          {(gjorteTiltak.length > 0 || droppedeTiltak.length > 0) && (
            <p className="text-xs text-gray-400 py-0.5">
              {gjorteTiltak.length > 0 && `${gjorteTiltak.length} gjennomført`}
              {gjorteTiltak.length > 0 && droppedeTiltak.length > 0 && ' · '}
              {droppedeTiltak.length > 0 && `${droppedeTiltak.length} droppet`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
