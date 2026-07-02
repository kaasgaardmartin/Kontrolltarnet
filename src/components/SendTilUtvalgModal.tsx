'use client'

import { useState, useEffect, useRef } from 'react'
import type { OffentligHoring } from '@/lib/actions'
import { hentLovutvalgForHoring, genererHoringEpostHtml, sendHoringEpostTilMedlemmer } from '@/lib/actions'
import DraggableModal from '@/components/DraggableModal'

interface Mottaker {
  id: string
  navn: string
  epost: string
  utvalg: string
  valgt: boolean
}

interface Props {
  horing: OffentligHoring
  onLukk: () => void
  onSendt: (sendt: number, feilet: number) => void
}

export default function SendTilUtvalgModal({ horing, onLukk, onSendt }: Props) {
  const [laster, setLaster] = useState(true)
  const [mottakere, setMottakere] = useState<Mottaker[]>([])
  const [subject, setSubject] = useState('')
  const [initialHtml, setInitialHtml] = useState('')
  const [sender, setSender] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [ferdig, setFerdig] = useState(false)
  const [antallSendt, setAntallSendt] = useState(0)
  const [antallFeilet, setAntallFeilet] = useState(0)
  const [harFokus, setHarFokus] = useState(false)

  // contentEditable-ref — vi styrer innerHTML direkte, ikke via React state
  const editableRef = useRef<HTMLDivElement>(null)
  const htmlSattRef = useRef(false)

  useEffect(() => {
    async function last() {
      const [utvalgData, previewData] = await Promise.all([
        hentLovutvalgForHoring(horing.utvalg ?? []),
        genererHoringEpostHtml(horing.id),
      ])

      const alleMottakere: Mottaker[] = []
      for (const u of utvalgData) {
        for (const m of u.medlemmer) {
          if (!alleMottakere.find(x => x.epost === m.epost)) {
            alleMottakere.push({ id: m.id, navn: m.navn, epost: m.epost, utvalg: u.utvalg, valgt: true })
          }
        }
      }
      setMottakere(alleMottakere)

      if (previewData) {
        setSubject(previewData.subject)
        setInitialHtml(previewData.html)
      }
      setLaster(false)
    }
    last()
  }, [horing.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sett innerHTML én gang når diven er i DOM og vi har HTML
  useEffect(() => {
    if (!laster && initialHtml && editableRef.current && !htmlSattRef.current) {
      editableRef.current.innerHTML = initialHtml
      htmlSattRef.current = true
    }
  }, [laster, initialHtml])

  function toggleMottaker(epost: string) {
    setMottakere(prev => prev.map(m => m.epost === epost ? { ...m, valgt: !m.valgt } : m))
  }

  function toggleAlle() {
    const alleValgt = mottakere.every(m => m.valgt)
    setMottakere(prev => prev.map(m => ({ ...m, valgt: !alleValgt })))
  }

  async function handleSend() {
    const valgte = mottakere.filter(m => m.valgt)
    if (valgte.length === 0) { setFeil('Velg minst én mottaker'); return }
    setSender(true)
    setFeil(null)
    const html = editableRef.current?.innerHTML ?? ''
    const res = await sendHoringEpostTilMedlemmer({
      mottakere: valgte.map(m => ({ navn: m.navn, epost: m.epost })),
      subject,
      html,
    })
    setSender(false)
    if (res.success) {
      setAntallSendt(res.sendt)
      setAntallFeilet(res.feilet)
      setFerdig(true)
      onSendt(res.sendt, res.feilet)
    } else {
      setFeil(res.error ?? 'Noe gikk galt')
    }
  }

  const valgtAntall = mottakere.filter(m => m.valgt).length

  const utvalgGrupper = mottakere.reduce<Record<string, Mottaker[]>>((acc, m) => {
    if (!acc[m.utvalg]) acc[m.utvalg] = []
    acc[m.utvalg].push(m)
    return acc
  }, {})

  return (
    <DraggableModal onLukk={onLukk} defaultWidth={920} defaultHeight={700} minWidth={600} minHeight={400} zIndex={60}>

        {/* Header */}
        <div className="modal-drag-handle flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 cursor-move select-none">
          <div>
            <h2 className="text-base font-semibold text-[#0F1923]">Send e-post til utvalgsmedlemmer</h2>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{horing.tittel}</p>
          </div>
          <button onClick={onLukk} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {laster ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-6 h-6 animate-spin text-[#4A9EDB]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm text-gray-400">Henter utvalgsmedlemmer og genererer e-post…</p>
            </div>
          </div>
        ) : ferdig ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-900">
                {antallSendt} e-post{antallSendt !== 1 ? 'er' : ''} sendt
              </p>
              {antallFeilet > 0 && (
                <p className="text-sm text-red-500">{antallFeilet} feilet</p>
              )}
              <button onClick={onLukk} className="mt-4 px-5 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors">
                Lukk
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 flex overflow-hidden min-h-0">

              {/* Venstre: mottakere */}
              <div className="w-64 shrink-0 border-r border-gray-100 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mottakere</p>
                  {mottakere.length > 0 && (
                    <button onClick={toggleAlle} className="text-xs text-[#4A9EDB] hover:underline">
                      {mottakere.every(m => m.valgt) ? 'Fjern alle' : 'Velg alle'}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                  {mottakere.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-xs text-gray-400">Ingen registrerte medlemmer for valgte utvalg.</p>
                      <p className="text-xs text-gray-300 mt-1">Legg til under Admin → Lovutvalg.</p>
                    </div>
                  ) : (
                    Object.entries(utvalgGrupper).map(([utvalgNavn, members]) => (
                      <div key={utvalgNavn} className="mb-3">
                        <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                          {utvalgNavn}
                        </p>
                        {members.map(m => (
                          <label key={m.epost} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={m.valgt}
                              onChange={() => toggleMottaker(m.epost)}
                              className="mt-0.5 shrink-0 accent-[#4A9EDB]"
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 truncate">{m.navn}</p>
                              <p className="text-xs text-gray-400 truncate">{m.epost}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400">{valgtAntall} av {mottakere.length} valgt</p>
                </div>
              </div>

              {/* Høyre: redigerbar e-post */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-2.5 border-b border-gray-100 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Emne</span>
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="flex-1 text-xs text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 min-w-0"
                    />
                  </div>
                  {harFokus && (
                    <span className="text-[10px] text-[#4A9EDB] shrink-0 ml-2">Redigerer</span>
                  )}
                  {!harFokus && (
                    <span className="text-[10px] text-gray-300 shrink-0 ml-2">Klikk i teksten for å redigere</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div
                    ref={editableRef}
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => setHarFokus(true)}
                    onBlur={() => setHarFokus(false)}
                    className={`min-h-full p-1 focus:outline-none transition-colors ${
                      harFokus ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50/50'
                    }`}
                    style={{ cursor: 'text' }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <div>
                {feil && <p className="text-sm text-red-500">{feil}</p>}
                {mottakere.length === 0 && !feil && (
                  <p className="text-xs text-amber-600">Ingen registrerte utvalgsmedlemmer — legg til under Admin → Lovutvalg.</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onLukk} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                  Avbryt
                </button>
                <button
                  onClick={handleSend}
                  disabled={sender || valgtAntall === 0}
                  className="px-5 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  {sender ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Sender…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                      Send til {valgtAntall} mottaker{valgtAntall !== 1 ? 'e' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
    </DraggableModal>
  )
}
