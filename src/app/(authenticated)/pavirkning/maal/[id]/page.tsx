'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMaalDetaljer, useInvaliderPavirkning, useTemaer } from '@/lib/pavirkning-queries'
import { maalStatus, statusFarge } from '@/lib/pavirkning-regler'
import { arkiverMaal, gjenapneMaal, oppdaterMaal, opprettStatusoppdatering } from '@/lib/pavirkning-actions'
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
  const { data: temaer } = useTemaer()
  const { invaliderMaal } = useInvaliderPavirkning()
  const [fane, setFane] = useState<Fane>('nokkelresultater')
  const [visArkiver, setVisArkiver] = useState(false)
  const [arkivUtfall, setArkivUtfall] = useState<MaalUtfall>('oppnadd')
  const [arkivOppsummering, setArkivOppsummering] = useState('')
  const [arkiverer, setArkiverer] = useState(false)

  // Redigering
  const [redigerer, setRedigerer] = useState(false)
  const [redTittel, setRedTittel] = useState('')
  const [redFormulering, setRedFormulering] = useState('')
  const [redStatusTekst, setRedStatusTekst] = useState('')
  const [redTemaId, setRedTemaId] = useState('')
  const [lagrer, setLagrer] = useState(false)

  // Statusoppdatering
  const [visStatusSkjema, setVisStatusSkjema] = useState(false)
  const [statusKommentar, setStatusKommentar] = useState('')
  const [senderStatus, setSenderStatus] = useState(false)

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

  function startRediger() {
    setRedTittel(maal!.tittel)
    setRedFormulering(maal!.formulering || '')
    setRedStatusTekst(maal!.status_tekst || '')
    setRedTemaId(maal!.tema_id)
    setRedigerer(true)
  }

  async function handleLagre() {
    if (!redTittel.trim()) return
    setLagrer(true)
    const res = await oppdaterMaal(maalId, {
      tittel: redTittel.trim(),
      formulering: redFormulering.trim() || null,
      status_tekst: redStatusTekst.trim() || null,
      tema_id: redTemaId,
    })
    if (res.success) {
      invaliderMaal(maalId)
      setRedigerer(false)
    }
    setLagrer(false)
  }

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

  async function handleSendStatus() {
    if (!statusKommentar.trim()) return
    setSenderStatus(true)
    const res = await opprettStatusoppdatering({
      maal_id: maalId,
      kommentar: statusKommentar.trim(),
    })
    if (res.success) {
      invaliderMaal(maalId)
      setStatusKommentar('')
      setVisStatusSkjema(false)
    }
    setSenderStatus(false)
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
      {redigerer ? (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tittel</label>
            <input
              type="text"
              value={redTittel}
              onChange={e => setRedTittel(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Formulering</label>
            <textarea
              value={redFormulering}
              onChange={e => setRedFormulering(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
              placeholder="Beskriv målet med en tydelig formulering"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tema</label>
            <select
              value={redTemaId}
              onChange={e => setRedTemaId(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              {temaer?.map(t => (
                <option key={t.id} value={t.id}>{t.navn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statustekst</label>
            <input
              type="text"
              value={redStatusTekst}
              onChange={e => setRedStatusTekst(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Kort statusbeskrivelse"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLagre}
              disabled={lagrer || !redTittel.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              {lagrer ? 'Lagrer…' : 'Lagre'}
            </button>
            <button
              onClick={() => setRedigerer(false)}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-900">{maal.tittel}</h1>
            {!maal.arkivert && (
              <button
                onClick={startRediger}
                className="shrink-0 text-xs text-gray-400 hover:text-[#4A9EDB] transition-colors"
              >
                Rediger
              </button>
            )}
          </div>
          {maal.formulering && (
            <div className="mt-3 border-l-[3px] border-[#4A9EDB] pl-4 py-2 bg-slate-50 rounded-r-md">
              <p className="text-[15px] leading-relaxed text-gray-800">{maal.formulering}</p>
            </div>
          )}
        </div>
      )}

      {/* Handlinger */}
      <div className="flex items-center gap-2">
        {!maal.arkivert ? (
          <>
            <button
              onClick={() => setVisArkiver(!visArkiver)}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-2 py-1"
            >
              Avslutt og arkiver
            </button>
            {!maal.ventende_oppdatering && (
              <button
                onClick={() => setVisStatusSkjema(!visStatusSkjema)}
                className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] border border-[#4A9EDB] rounded-md px-2 py-1"
              >
                Send statusoppdatering
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleGjenapne}
            className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] border border-[#4A9EDB] rounded-md px-2 py-1"
          >
            Gjenåpne
          </button>
        )}
      </div>

      {/* Statusoppdateringsskjema */}
      {visStatusSkjema && (
        <div className="border border-[#4A9EDB]/30 rounded-lg p-4 bg-blue-50/40 space-y-3">
          <p className="text-sm font-medium text-gray-700">Ny statusoppdatering</p>
          <p className="text-xs text-gray-500">
            Oppdateringen sendes som forslag og bekreftes i neste politisk kvarter.
          </p>
          <textarea
            value={statusKommentar}
            onChange={e => setStatusKommentar(e.target.value)}
            placeholder="Hva har skjedd siden sist? Nye hendelser, endret risiko, fremdrift…"
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSendStatus}
              disabled={senderStatus || !statusKommentar.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              {senderStatus ? 'Sender…' : 'Send oppdatering'}
            </button>
            <button
              onClick={() => { setVisStatusSkjema(false); setStatusKommentar('') }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

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
