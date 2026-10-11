'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTemaer } from '@/lib/pavirkning-queries'
import { opprettMaal } from '@/lib/pavirkning-actions'

export default function NyttMaal() {
  const router = useRouter()
  const { data: temaer = [] } = useTemaer()
  const [tittel, setTittel] = useState('')
  const [temaId, setTemaId] = useState('')
  const [formulering, setFormulering] = useState('')
  const [statusTekst, setStatusTekst] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState('')

  async function handleLagre(e: React.FormEvent) {
    e.preventDefault()
    if (!tittel.trim()) { setFeil('Tittel er påkrevd'); return }
    if (!temaId) { setFeil('Velg et tema'); return }

    setLagrer(true)
    setFeil('')
    const resultat = await opprettMaal({
      tittel: tittel.trim(),
      tema_id: temaId,
      formulering: formulering.trim() || undefined,
      status_tekst: statusTekst.trim() || undefined,
    })

    if (resultat.success && resultat.id) {
      router.push(`/pavirkning/maal/${resultat.id}`)
    } else {
      setFeil(resultat.error ?? 'Noe gikk galt')
      setLagrer(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/pavirkning" className="text-sm text-gray-500 hover:text-[#4A9EDB] mb-4 inline-block">
        ← Tilbake til oversikten
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Nytt mål</h1>

      <form onSubmit={handleLagre} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tittel <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={tittel}
            onChange={e => setTittel(e.target.value)}
            placeholder="Kort navn på målet"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tema <span className="text-red-500">*</span>
          </label>
          <select
            value={temaId}
            onChange={e => setTemaId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">Velg tema</option>
            {temaer.map(t => (
              <option key={t.id} value={t.id}>{t.navn}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statustekst</label>
          <input
            type="text"
            value={statusTekst}
            onChange={e => setStatusTekst(e.target.value)}
            placeholder="F.eks. «Prioritet 1» eller «Vedtatt»"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formulering</label>
          <textarea
            value={formulering}
            onChange={e => setFormulering(e.target.value)}
            placeholder="Hele målformuleringen"
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          />
        </div>

        {feil && (
          <p className="text-sm text-red-600">{feil}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={lagrer}
            className="px-4 py-2 text-sm rounded-md bg-[#4A9EDB] text-white hover:bg-[#3a8ecb] transition-colors disabled:opacity-50"
          >
            {lagrer ? 'Lagrer…' : 'Opprett mål'}
          </button>
          <Link
            href="/pavirkning"
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  )
}
