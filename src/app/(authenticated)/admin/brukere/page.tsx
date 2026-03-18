'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { hentBrukere, oppdaterBrukerRolle, oppdaterBrukerStatus, hentBrukerOgOrg } from '@/lib/actions'
import type { Bruker, Rolle } from '@/lib/types'

const ROLLE_LABELS: Record<Rolle, string> = {
  'leser': 'Leser',
  'redaktør': 'Redaktør',
  'org-admin': 'Org-admin',
}

const ROLLE_STIL: Record<Rolle, string> = {
  'leser': 'bg-gray-100 text-gray-700',
  'redaktør': 'bg-[#4A9EDB]/10 text-[#4A9EDB]',
  'org-admin': 'bg-amber-100 text-amber-700',
}

export default function BrukereAdminPage() {
  const router = useRouter()
  const [brukere, setBrukere] = useState<Bruker[]>([])
  const [innloggetId, setInnloggetId] = useState<string | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [endrerRolle, setEndrerRolle] = useState<string | null>(null)
  const [endrerStatus, setEndrerStatus] = useState<string | null>(null)

  const lastBrukere = useCallback(async () => {
    const data = await hentBrukere()
    setBrukere(data)
    setLaster(false)
  }, [])

  useEffect(() => {
    hentBrukerOgOrg().then((b) => {
      if (!b || b.rolle !== 'org-admin') {
        router.push('/')
        return
      }
      setInnloggetId(b.id)
      lastBrukere()
    })
  }, [lastBrukere, router])

  async function handleRolleEndring(brukerId: string, nyRolle: Rolle) {
    setEndrerRolle(brukerId)
    setFeil(null)
    const result = await oppdaterBrukerRolle(brukerId, nyRolle)
    if (!result.success) {
      setFeil(result.error || 'Kunne ikke endre rolle')
    } else {
      await lastBrukere()
    }
    setEndrerRolle(null)
  }

  async function handleStatusToggle(bruker: Bruker) {
    setEndrerStatus(bruker.id)
    setFeil(null)
    const result = await oppdaterBrukerStatus(bruker.id, !bruker.aktiv)
    if (!result.success) {
      setFeil(result.error || 'Kunne ikke endre status')
    } else {
      await lastBrukere()
    }
    setEndrerStatus(null)
  }

  function formaterDato(dato: string) {
    return new Date(dato).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (laster) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Brukere</h1>
        <p className="text-sm text-gray-500 mt-1">
          Administrer brukere i organisasjonen. Nye brukere med @advokatforeningen.no-epost
          får automatisk tilgang som leser.
        </p>
      </div>

      {feil && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {feil}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Bruker
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Rolle
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Registrert
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {brukere.map((b) => {
                const erDegSelv = b.id === innloggetId
                return (
                  <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${!b.aktiv ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#4A9EDB] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {b.navn?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {b.navn}
                            {erDegSelv && (
                              <span className="ml-2 text-xs text-gray-400">(deg)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{b.epost}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {erDegSelv ? (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${ROLLE_STIL[b.rolle]}`}>
                          {ROLLE_LABELS[b.rolle]}
                        </span>
                      ) : (
                        <select
                          value={b.rolle}
                          onChange={(e) => handleRolleEndring(b.id, e.target.value as Rolle)}
                          disabled={endrerRolle === b.id}
                          className={`text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#4A9EDB]/40 ${
                            endrerRolle === b.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                          }`}
                        >
                          <option value="leser">Leser</option>
                          <option value="redaktør">Redaktør</option>
                          <option value="org-admin">Org-admin</option>
                        </select>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                          b.aktiv
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${b.aktiv ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {b.aktiv ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formaterDato(b.created_at)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {!erDegSelv && (
                        <button
                          onClick={() => handleStatusToggle(b)}
                          disabled={endrerStatus === b.id}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            endrerStatus === b.id
                              ? 'opacity-50 cursor-wait border-gray-200 text-gray-400'
                              : b.aktiv
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {endrerStatus === b.id
                            ? 'Lagrer...'
                            : b.aktiv
                            ? 'Deaktiver'
                            : 'Aktiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}

              {brukere.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                    Ingen brukere registrert ennå.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">
            {brukere.length} {brukere.length === 1 ? 'bruker' : 'brukere'} totalt
            {' \u2022 '}
            {brukere.filter((b) => b.aktiv).length} aktive
          </p>
        </div>
      </div>
    </div>
  )
}
