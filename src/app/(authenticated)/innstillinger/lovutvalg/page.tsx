'use client'

import { useState, useEffect } from 'react'
import {
  hentLovutvalg, opprettLovutvalg, slettLovutvalg,
  leggTilMedlem, slettMedlem,
} from '@/lib/actions'
import type { Lovutvalg } from '@/lib/actions'

export default function LovutvalgAdminPage() {
  const [utvalg, setUtvalg] = useState<Lovutvalg[]>([])
  const [laster, setLaster] = useState(true)
  const [nyttNavn, setNyttNavn] = useState('')
  const [openet, setOpenet] = useState<string | null>(null)
  const [nyMedlemNavn, setNyMedlemNavn] = useState('')
  const [nyMedlemEpost, setNyMedlemEpost] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  async function last() {
    const data = await hentLovutvalg()
    setUtvalg(data)
    setLaster(false)
  }

  useEffect(() => { last() }, [])

  async function handleOpprettUtvalg() {
    if (!nyttNavn.trim()) return
    setLagrer(true)
    const res = await opprettLovutvalg(nyttNavn)
    if (res.success) { setNyttNavn(''); await last() }
    else setFeil(res.error ?? 'Feil')
    setLagrer(false)
  }

  async function handleSlettUtvalg(id: string) {
    if (!confirm('Slette utvalget og alle medlemmer?')) return
    await slettLovutvalg(id)
    await last()
  }

  async function handleLeggTilMedlem(lovutvalgId: string) {
    if (!nyMedlemNavn.trim() || !nyMedlemEpost.trim()) return
    setLagrer(true)
    const res = await leggTilMedlem(lovutvalgId, nyMedlemNavn, nyMedlemEpost)
    if (res.success) { setNyMedlemNavn(''); setNyMedlemEpost(''); await last() }
    else setFeil(res.error ?? 'Feil')
    setLagrer(false)
  }

  async function handleSlettMedlem(id: string) {
    await slettMedlem(id)
    await last()
  }

  if (laster) return <div className="p-6 text-sm text-gray-400">Laster…</div>

  return (
    <div className="space-y-6">
      {/* Opprett nytt utvalg */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">Opprett nytt utvalg</p>
        <div className="flex gap-2">
          <input
            value={nyttNavn}
            onChange={e => setNyttNavn(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOpprettUtvalg()}
            placeholder="Navn på utvalg"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4A9EDB]"
          />
          <button
            onClick={handleOpprettUtvalg}
            disabled={lagrer || !nyttNavn.trim()}
            className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors"
          >
            Opprett
          </button>
        </div>
        {feil && <p className="text-xs text-red-500 mt-2">{feil}</p>}
      </div>

      {/* Liste over utvalg */}
      {utvalg.length === 0 ? (
        <p className="text-sm text-gray-400">Ingen utvalg opprettet ennå.</p>
      ) : (
        <div className="space-y-4">
          {utvalg.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Utvalg-header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <button
                  onClick={() => setOpenet(openet === u.id ? null : u.id)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-[#4A9EDB]"
                >
                  <span className={`text-xs transition-transform ${openet === u.id ? 'rotate-90' : ''}`}>▶</span>
                  {u.navn}
                  <span className="text-xs font-normal text-gray-400">{u.medlemmer.length} {u.medlemmer.length === 1 ? 'medlem' : 'medlemmer'}</span>
                </button>
                <button
                  onClick={() => handleSlettUtvalg(u.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Slett utvalg
                </button>
              </div>

              {openet === u.id && (
                <div className="px-5 py-4 space-y-4">
                  {/* Medlemsliste */}
                  {u.medlemmer.length === 0 ? (
                    <p className="text-xs text-gray-400">Ingen medlemmer ennå.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {u.medlemmer.map(m => (
                        <div key={m.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm text-gray-800">{m.navn}</p>
                            <p className="text-xs text-gray-400">{m.epost}</p>
                          </div>
                          <button
                            onClick={() => handleSlettMedlem(m.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            Fjern
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legg til medlem */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Legg til medlem</p>
                    <div className="flex gap-2">
                      <input
                        value={nyMedlemNavn}
                        onChange={e => setNyMedlemNavn(e.target.value)}
                        placeholder="Navn"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4A9EDB]"
                      />
                      <input
                        value={nyMedlemEpost}
                        onChange={e => setNyMedlemEpost(e.target.value)}
                        placeholder="E-post"
                        type="email"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4A9EDB]"
                      />
                      <button
                        onClick={() => handleLeggTilMedlem(u.id)}
                        disabled={lagrer || !nyMedlemNavn.trim() || !nyMedlemEpost.trim()}
                        className="px-3 py-1.5 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        Legg til
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
