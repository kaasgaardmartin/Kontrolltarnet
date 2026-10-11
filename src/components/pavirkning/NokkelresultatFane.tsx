'use client'

import { useState } from 'react'
import type { MaalMedDetaljer, NokkelresultatMedTiltak, KRType, GjennomslagVerdi, KildeType, GjennomslagVurdering } from '@/lib/pavirkning-types'
import { krStatus, krVerdi, statusFarge, tiltakPassertFrist, tiltakForfaller, ingenAktivitet } from '@/lib/pavirkning-regler'
import { useInvaliderPavirkning } from '@/lib/pavirkning-queries'
import { useOrgBrukere } from '@/lib/queries'
import {
  opprettNokkelresultat, oppdaterNokkelresultat, slettNokkelresultat, byttKRType,
  opprettTiltak, oppdaterTiltak, markerTiltakGjort, droppTiltak, utsettTiltak,
  opprettGjennomslag,
} from '@/lib/pavirkning-actions'

interface Props {
  maal: MaalMedDetaljer
}

export default function NokkelresultatFane({ maal }: Props) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const [visNyttKR, setVisNyttKR] = useState(false)

  return (
    <div className="space-y-3">
      {maal.nokkelresultater.map(kr => (
        <KRKort key={kr.id} kr={kr} maalId={maal.id} />
      ))}

      {visNyttKR ? (
        <NyttKRSkjema
          maalId={maal.id}
          onLagret={() => { setVisNyttKR(false); invaliderMaal(maal.id) }}
          onAvbryt={() => setVisNyttKR(false)}
        />
      ) : (
        <button
          onClick={() => setVisNyttKR(true)}
          className="text-sm text-[#4A9EDB] hover:text-[#3a8ecb]"
        >
          + Legg til nøkkelresultat
        </button>
      )}

      <p className="text-xs text-gray-400 mt-2">
        Tips: Aktiviteter dere styrer selv (som «levere høringssvar») bør være tiltak, ikke nøkkelresultater.
      </p>
    </div>
  )
}

function KRKort({ kr, maalId }: { kr: NokkelresultatMedTiltak; maalId: string }) {
  const [utvidet, setUtvidet] = useState(false)
  const [redigerer, setRedigerer] = useState(false)
  const [visNyttTiltak, setVisNyttTiltak] = useState(false)
  const { invaliderMaal } = useInvaliderPavirkning()
  const status = krStatus(kr)
  const farge = statusFarge(status)
  const verdi = krVerdi(kr)

  const aapneTiltak = kr.tiltak.filter(t => t.status === 'planlagt')
  const gjorteTiltak = kr.tiltak.filter(t => t.status === 'utført')
  const droppedeTiltak = kr.tiltak.filter(t => t.status === 'avlyst')

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Linje */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setUtvidet(!utvidet)}>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${utvidet ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800">{kr.tekst}</p>
          {kr.frist_tekst && <p className="text-xs text-gray-400 mt-0.5">{kr.frist_tekst}</p>}
        </div>

        {/* Fremdrift */}
        <div className="w-20 h-1.5 bg-gray-100 rounded-full shrink-0 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${kr.oppnadd ? 100 : Math.max(10, kr.sannsynlighet * 10)}%`, backgroundColor: farge }}
          />
        </div>

        <span className="text-xs text-gray-500 shrink-0 w-16 text-right">{verdi}</span>

        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: farge + '18', color: farge }}
        >
          {status}
        </span>
      </div>

      {/* Utvidet */}
      {utvidet && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Varsler */}
          {ingenAktivitet(kr) && (
            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
              Ingen åpne tiltak
            </div>
          )}

          {/* Gjennomslag-velger for type gjennomslag */}
          {kr.type === 'gjennomslag' && !kr.oppnadd && (
            <GjennomslagVelger kr={kr} maalId={maalId} />
          )}

          {/* Milepæl: marker oppnådd */}
          {kr.type === 'milepael' && (
            <button
              onClick={async () => {
                await oppdaterNokkelresultat(kr.id, { oppnadd: !kr.oppnadd })
                invaliderMaal(maalId)
              }}
              className={`text-xs px-2 py-1 rounded-md border ${
                kr.oppnadd
                  ? 'border-green-300 text-green-700 bg-green-50'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {kr.oppnadd ? 'Oppnådd — Gjenåpne' : 'Marker som oppnådd'}
            </button>
          )}

          {/* Tall: nå/mål */}
          {kr.type === 'tall' && (
            <TallRedigering kr={kr} maalId={maalId} />
          )}

          {/* Rediger/slett */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRedigerer(!redigerer)}
              className="text-xs text-gray-500 hover:text-[#4A9EDB]"
            >
              Rediger
            </button>
            <SletteKnapp
              onSlett={async () => {
                await slettNokkelresultat(kr.id)
                invaliderMaal(maalId)
              }}
            />
          </div>

          {redigerer && (
            <RedigerKRSkjema
              kr={kr}
              maalId={maalId}
              onFerdig={() => { setRedigerer(false); invaliderMaal(maalId) }}
            />
          )}

          {/* Tiltak */}
          {!kr.oppnadd && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 mt-2">Tiltak</p>
              {aapneTiltak.map(t => (
                <TiltakLinje key={t.id} tiltak={t} maalId={maalId} />
              ))}
              {aapneTiltak.length === 0 && (
                <p className="text-xs text-gray-400 italic">Ingen åpne tiltak</p>
              )}
              {(gjorteTiltak.length > 0 || droppedeTiltak.length > 0) && (
                <p className="text-xs text-gray-400">
                  {gjorteTiltak.length > 0 && `${gjorteTiltak.length} gjennomført`}
                  {gjorteTiltak.length > 0 && droppedeTiltak.length > 0 && ' · '}
                  {droppedeTiltak.length > 0 && `${droppedeTiltak.length} droppet`}
                </p>
              )}

              {visNyttTiltak ? (
                <NyttTiltakSkjema
                  nokkelresultatId={kr.id}
                  maalId={maalId}
                  onLagret={() => { setVisNyttTiltak(false); invaliderMaal(maalId) }}
                  onAvbryt={() => setVisNyttTiltak(false)}
                />
              ) : (
                <button
                  onClick={() => setVisNyttTiltak(true)}
                  className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb]"
                >
                  + Legg til tiltak
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GjennomslagVelger({ kr, maalId }: { kr: NokkelresultatMedTiltak; maalId: string }) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const [visKildeSkjema, setVisKildeSkjema] = useState(false)
  const [nyVerdi, setNyVerdi] = useState<GjennomslagVerdi | ''>('')
  const [kildeType, setKildeType] = useState<KildeType>('innstilling')
  const [kildeTekst, setKildeTekst] = useState('')
  const [kildeUrl, setKildeUrl] = useState('')
  const [vurdering, setVurdering] = useState<GjennomslagVurdering>('bidrar')

  const verdier: { key: GjennomslagVerdi; label: string }[] = [
    { key: 'ukjent', label: 'Ukjent' },
    { key: 'ikke', label: 'Ikke' },
    { key: 'delvis', label: 'Delvis' },
    { key: 'fullt', label: 'Fullt' },
  ]

  async function handleVelg(v: GjennomslagVerdi) {
    if (v === 'ukjent') {
      await oppdaterNokkelresultat(kr.id, { gjennomslag: v, oppnadd: false })
      invaliderMaal(maalId)
    } else {
      setNyVerdi(v)
      setVisKildeSkjema(true)
    }
  }

  async function handleLagreGjennomslag() {
    if (!kildeTekst.trim() || !nyVerdi) return
    await oppdaterNokkelresultat(kr.id, {
      gjennomslag: nyVerdi,
      oppnadd: nyVerdi === 'fullt',
    })
    await opprettGjennomslag({
      maal_id: maalId,
      nokkelresultat_id: kr.id,
      dato: new Date().toISOString().slice(0, 10),
      kilde_type: kildeType,
      tekst: kildeTekst.trim(),
      vurdering,
      url: kildeUrl.trim() || null,
    })
    setVisKildeSkjema(false)
    setNyVerdi('')
    setKildeTekst('')
    setKildeUrl('')
    invaliderMaal(maalId)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">Gjennomslag</p>
      <div className="flex gap-1">
        {verdier.map(v => (
          <button
            key={v.key}
            onClick={() => handleVelg(v.key)}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              kr.gjennomslag === v.key
                ? 'border-[#4A9EDB] bg-[#4A9EDB]/10 text-[#4A9EDB]'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {visKildeSkjema && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-medium text-gray-700">Kilde (påkrevd)</p>
          <select
            value={kildeType}
            onChange={e => setKildeType(e.target.value as KildeType)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white w-full"
          >
            <option value="innstilling">Innstilling</option>
            <option value="proposisjon">Proposisjon</option>
            <option value="vedtak">Vedtak</option>
            <option value="stortingsdebatt">Stortingsdebatt</option>
            <option value="horingssvar">Høringssvar</option>
            <option value="motereferat">Møtereferat</option>
            <option value="media">Media</option>
          </select>
          <input
            type="text"
            value={kildeTekst}
            onChange={e => setKildeTekst(e.target.value)}
            placeholder="Beskriv gjennomslaget"
            className="text-xs border border-gray-300 rounded-md px-2 py-1 w-full"
          />
          <select
            value={vurdering}
            onChange={e => setVurdering(e.target.value as GjennomslagVurdering)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white w-full"
          >
            <option value="bidrar">Bidrar</option>
            <option value="delvis">Delvis</option>
            <option value="fullt">Fullt</option>
            <option value="ikke">Ikke</option>
          </select>
          <input
            type="text"
            value={kildeUrl}
            onChange={e => setKildeUrl(e.target.value)}
            placeholder="URL (valgfritt)"
            className="text-xs border border-gray-300 rounded-md px-2 py-1 w-full"
          />
          <div className="flex gap-2">
            <button
              onClick={handleLagreGjennomslag}
              disabled={!kildeTekst.trim()}
              className="text-xs px-2 py-1 rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50"
            >
              Lagre
            </button>
            <button
              onClick={() => { setVisKildeSkjema(false); setNyVerdi('') }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TallRedigering({ kr, maalId }: { kr: NokkelresultatMedTiltak; maalId: string }) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const [naa, setNaa] = useState(kr.tall_naa?.toString() ?? '')
  const [maalVerdi, setMaalVerdi] = useState(kr.tall_maal?.toString() ?? '')

  async function handleLagre() {
    const naaNum = parseInt(naa) || 0
    const maalNum = parseInt(maalVerdi) || 0
    await oppdaterNokkelresultat(kr.id, {
      tall_naa: naaNum,
      tall_maal: maalNum,
      oppnadd: maalNum > 0 && naaNum >= maalNum,
    })
    invaliderMaal(maalId)
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600">Nå:</label>
      <input
        type="number"
        value={naa}
        onChange={e => setNaa(e.target.value)}
        className="w-16 text-xs border border-gray-300 rounded-md px-2 py-1"
      />
      <label className="text-xs text-gray-600">Mål:</label>
      <input
        type="number"
        value={maalVerdi}
        onChange={e => setMaalVerdi(e.target.value)}
        className="w-16 text-xs border border-gray-300 rounded-md px-2 py-1"
      />
      <button
        onClick={handleLagre}
        className="text-xs px-2 py-1 rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb]"
      >
        Oppdater
      </button>
    </div>
  )
}

function TiltakLinje({ tiltak, maalId }: { tiltak: import('@/lib/pavirkning-types').TiltakAktivitet; maalId: string }) {
  const { invaliderMaal } = useInvaliderPavirkning()
  const passert = tiltakPassertFrist(tiltak)

  return (
    <div className="flex items-center gap-2 text-xs py-1 group">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
      <span className="flex-1 min-w-0 truncate text-gray-700">{tiltak.beskrivelse}</span>
      {tiltak.brukere?.navn && (
        <span className="text-gray-400 shrink-0">{tiltak.brukere.navn}</span>
      )}
      {tiltak.frist && (
        <span className={`shrink-0 ${passert ? 'text-[#BA0C2F] font-medium' : 'text-gray-400'}`}>
          {passert ? 'forfalt' : new Date(tiltak.frist).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}
        </span>
      )}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <button
          onClick={async () => { await markerTiltakGjort(tiltak.id); invaliderMaal(maalId) }}
          className="text-green-600 hover:text-green-800" title="Gjort"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={async () => { await droppTiltak(tiltak.id); invaliderMaal(maalId) }}
          className="text-red-500 hover:text-red-700" title="Dropp"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {tiltakForfaller(tiltak) && (
          <button
            onClick={async () => { await utsettTiltak(tiltak.id); invaliderMaal(maalId) }}
            className="text-amber-500 hover:text-amber-700" title="Utsett 1 uke"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function NyttKRSkjema({ maalId, onLagret, onAvbryt }: { maalId: string; onLagret: () => void; onAvbryt: () => void }) {
  const [tekst, setTekst] = useState('')
  const [type, setType] = useState<KRType>('gjennomslag')
  const [fristTekst, setFristTekst] = useState('')
  const [lagrer, setLagrer] = useState(false)

  async function handleLagre() {
    if (!tekst.trim()) return
    setLagrer(true)
    await opprettNokkelresultat({ maal_id: maalId, tekst: tekst.trim(), type, frist_tekst: fristTekst.trim() || undefined })
    onLagret()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <input
        type="text"
        value={tekst}
        onChange={e => setTekst(e.target.value)}
        placeholder="Tekst for nøkkelresultatet"
        className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5"
        autoFocus
      />
      <div className="flex gap-2">
        <select value={type} onChange={e => setType(e.target.value as KRType)} className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white">
          <option value="gjennomslag">Gjennomslag</option>
          <option value="tall">Tall</option>
          <option value="milepael">Milepæl</option>
        </select>
        <input
          type="text"
          value={fristTekst}
          onChange={e => setFristTekst(e.target.value)}
          placeholder="Frist / hendelse (valgfritt)"
          className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={handleLagre} disabled={lagrer || !tekst.trim()} className="text-xs px-2 py-1 rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50">
          {lagrer ? 'Lagrer…' : 'Legg til'}
        </button>
        <button onClick={onAvbryt} className="text-xs text-gray-500 hover:text-gray-700">Avbryt</button>
      </div>
    </div>
  )
}

function NyttTiltakSkjema({ nokkelresultatId, maalId, onLagret, onAvbryt }: { nokkelresultatId: string; maalId: string; onLagret: () => void; onAvbryt: () => void }) {
  const { data: brukere = [] } = useOrgBrukere()
  const [beskrivelse, setBeskrivelse] = useState('')
  const [ansvarligId, setAnsvarligId] = useState('')
  const [frist, setFrist] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [lagrer, setLagrer] = useState(false)

  async function handleLagre() {
    if (!beskrivelse.trim()) return
    setLagrer(true)
    await opprettTiltak({ nokkelresultat_id: nokkelresultatId, beskrivelse: beskrivelse.trim(), ansvarlig_id: ansvarligId || null, frist })
    onLagret()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <input
        type="text"
        value={beskrivelse}
        onChange={e => setBeskrivelse(e.target.value)}
        placeholder="Hva skal gjøres?"
        className="w-full text-xs border border-gray-300 rounded-md px-2 py-1"
        autoFocus
      />
      <div className="flex gap-2">
        <select value={ansvarligId} onChange={e => setAnsvarligId(e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white flex-1">
          <option value="">Ingen ansvarlig</option>
          {brukere.map(b => <option key={b.id} value={b.id}>{b.navn}</option>)}
        </select>
        <input type="date" value={frist} onChange={e => setFrist(e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleLagre} disabled={lagrer || !beskrivelse.trim()} className="text-xs px-2 py-1 rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50">
          {lagrer ? 'Lagrer…' : 'Legg til'}
        </button>
        <button onClick={onAvbryt} className="text-xs text-gray-500 hover:text-gray-700">Avbryt</button>
      </div>
    </div>
  )
}

function RedigerKRSkjema({ kr, maalId, onFerdig }: { kr: NokkelresultatMedTiltak; maalId: string; onFerdig: () => void }) {
  const [tekst, setTekst] = useState(kr.tekst)
  const [type, setType] = useState<KRType>(kr.type)
  const [fristTekst, setFristTekst] = useState(kr.frist_tekst ?? '')
  const [lagrer, setLagrer] = useState(false)

  async function handleLagre() {
    setLagrer(true)
    if (type !== kr.type) {
      await byttKRType(kr.id, type)
    }
    await oppdaterNokkelresultat(kr.id, { tekst: tekst.trim(), frist_tekst: fristTekst.trim() || null })
    onFerdig()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <input type="text" value={tekst} onChange={e => setTekst(e.target.value)} className="w-full text-sm border border-gray-300 rounded-md px-2 py-1" />
      <div className="flex gap-2">
        <select value={type} onChange={e => setType(e.target.value as KRType)} className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white">
          <option value="gjennomslag">Gjennomslag</option>
          <option value="tall">Tall</option>
          <option value="milepael">Milepæl</option>
        </select>
        <input type="text" value={fristTekst} onChange={e => setFristTekst(e.target.value)} placeholder="Frist / hendelse" className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleLagre} disabled={lagrer} className="text-xs px-2 py-1 rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] disabled:opacity-50">
          {lagrer ? 'Lagrer…' : 'Lagre'}
        </button>
        <button onClick={onFerdig} className="text-xs text-gray-500 hover:text-gray-700">Avbryt</button>
      </div>
    </div>
  )
}

function SletteKnapp({ onSlett }: { onSlett: () => void }) {
  const [bekreft, setBekreft] = useState(false)

  if (bekreft) {
    return (
      <span className="text-xs">
        <span className="text-red-600">Slette? </span>
        <button onClick={onSlett} className="text-red-600 font-medium hover:underline">Ja</button>
        <span className="text-gray-400"> / </span>
        <button onClick={() => setBekreft(false)} className="text-gray-500 hover:underline">Nei</button>
      </span>
    )
  }

  return (
    <button onClick={() => setBekreft(true)} className="text-xs text-red-400 hover:text-red-600">
      Slett
    </button>
  )
}
