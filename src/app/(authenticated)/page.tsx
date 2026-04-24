'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Niva } from '@/lib/types'
import type { SakMedStemmer } from '@/lib/actions'
import type { Mandatfordeling } from '@/lib/flertall'
import type { StortingetSak } from '@/app/api/stortinget/route'
import { useSaker, useMandater, useKomiteer, useKommendeAktiviteter, useInvaliderSakData } from '@/lib/queries'
import Sakstabell from '@/components/Sakstabell'
import SakModal from '@/components/SakModal'
import StortingetImport from '@/components/StortingetImport'
import DelsakerSteg from '@/components/DelsakerSteg'
import ArkivSakerPanel from '@/components/ArkivSakerPanel'

type Filter = 'Alle' | 'Storting' | 'Departement' | 'Intern' | 'Behandles snart'

const FILTER_NIVA: Record<string, Niva | null> = {
  'Alle': null,
  'Storting': 'storting',
  'Departement': 'departement',
  'Intern': 'intern',
  'Behandles snart': null,
}

export default function Forsiden() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [sok, setSok] = useState('')
  const [aktivtFilter, setAktivtFilter] = useState<Filter>('Alle')
  const [komiteFilter, setKomiteFilter] = useState<string>('')
  const [sesjonFilter, setSesjonFilter] = useState<string>('')
  const [modalSak, setModalSak] = useState<SakMedStemmer | null | undefined>(undefined)
  const [visStortingetImport, setVisStortingetImport] = useState(false)
  const [importertSak, setImportertSak] = useState<StortingetSak | null>(null)
  const [delsakerSteg, setDelsakerSteg] = useState<{ sakId: string; tittel: string } | null>(null)
  const [fane, setFane] = useState<'aktive' | 'arkiv'>('aktive')

  const { invaliderSaker } = useInvaliderSakData()

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase
          .from('brukere')
          .select('id')
          .eq('id', user.id)
          .single()
          .then(({ data, error }) => {
            setHasProfile(!error && !!data)
          })
      }
    })
  }, [])

  // React Query hooks — data caches og deles mellom sider
  const { data: saker = [], isLoading: lasterSaker } = useSaker()
  const { data: mandater = [], isLoading: lasterMandater } = useMandater()
  const { data: komiteer = [] } = useKomiteer()
  const { data: aktiviteter = [] } = useKommendeAktiviteter()

  const laster = hasProfile === null || (hasProfile && (lasterSaker || lasterMandater))

  // Waiting list
  if (hasProfile === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#0F1923] mb-2">Venter på godkjenning</h2>
          <p className="text-sm text-gray-500 mb-4">
            Kontoen din er opprettet, men du er ikke tilknyttet noen organisasjon ennå.
            En administrator må godkjenne tilgangen din.
          </p>
          <p className="text-xs text-gray-400">
            Logget inn som {user?.email}
          </p>
        </div>
      </div>
    )
  }

  if (laster) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Laster...</div>
      </div>
    )
  }

  // Get unique sesjoner from saker
  const sesjoner = Array.from(new Set(
    saker.map(s => s.sesjon).filter((s): s is string => !!s)
  )).sort().reverse()

  // Filter logic
  const filtrerteSaker = saker.filter(sak => {
    if (sok) {
      const sokLower = sok.toLowerCase()
      const tittelMatch = sak.tittel.toLowerCase().includes(sokLower)
      const delsakMatch = sak.delsaker?.some(d => d.tittel.toLowerCase().includes(sokLower))
      const stakeholderMatch = sak.stakeholder_navn?.some(n => n.toLowerCase().includes(sokLower))
      if (!tittelMatch && !delsakMatch && !stakeholderMatch) return false
    }

    if (aktivtFilter === 'Behandles snart') {
      const now = new Date()
      const toUkerFrem = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const komiteDato = sak.komite_dato ? new Date(sak.komite_dato) : null
      const stortingsDato = sak.stortings_dato ? new Date(sak.stortings_dato) : null
      const harDatoSnart = (komiteDato && komiteDato >= now && komiteDato <= toUkerFrem) ||
                           (stortingsDato && stortingsDato >= now && stortingsDato <= toUkerFrem)
      if (!harDatoSnart) return false
    } else if (aktivtFilter !== 'Alle') {
      const niva = FILTER_NIVA[aktivtFilter]
      if (niva && sak.niva !== niva) return false
    }

    if (komiteFilter && sak.komite_id !== komiteFilter) return false
    if (sesjonFilter && sak.sesjon !== sesjonFilter) return false

    return true
  })

  return (
    <div>
      {/* Header area */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F1923]">Stortinget</h1>
          <p className="text-sm text-gray-500">
            {fane === 'aktive'
              ? `${saker.length} aktive saker${filtrerteSaker.length !== saker.length ? ` (${filtrerteSaker.length} vist)` : ''}`
              : 'Arkiverte saker'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            PDF-rapport
          </button>
          <button
            onClick={() => setVisStortingetImport(true)}
            className="px-4 py-2 text-sm border border-[#BA0C2F]/30 text-[#BA0C2F] rounded-lg hover:bg-[#BA0C2F]/5 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21" />
            </svg>
            Stortinget
          </button>
          <button
            onClick={() => setModalSak(null)}
            className="px-4 py-2 text-sm bg-[#4A9EDB] text-white rounded-lg hover:bg-[#3a8ecb] transition-colors"
          >
            + Ny sak
          </button>
        </div>
      </div>

      {/* Fane-velger */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['aktive', 'arkiv'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFane(f)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              fane === f
                ? 'border-[#4A9EDB] text-[#4A9EDB]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'aktive' ? 'Aktive' : 'Arkiv'}
          </button>
        ))}
      </div>

      {fane === 'arkiv' && <ArkivSakerPanel />}

      {fane === 'aktive' && <>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={sok}
            onChange={e => setSok(e.target.value)}
            placeholder="Søk i saker..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
          />
        </div>
        {(['Alle', 'Storting', 'Departement', 'Intern', 'Behandles snart'] as Filter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setAktivtFilter(filter)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
              filter === aktivtFilter
                ? 'bg-[#0F1923] text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {filter}
          </button>
        ))}
        {komiteer.length > 0 && (
          <select
            value={komiteFilter}
            onChange={e => setKomiteFilter(e.target.value)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors border ${
              komiteFilter
                ? 'bg-[#0F1923] text-white border-[#0F1923]'
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            <option value="">Alle komiteer</option>
            {komiteer.map(k => (
              <option key={k.id} value={k.id}>{k.navn}</option>
            ))}
          </select>
        )}
        {sesjoner.length > 0 && (
          <select
            value={sesjonFilter}
            onChange={e => setSesjonFilter(e.target.value)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors border ${
              sesjonFilter
                ? 'bg-[#0F1923] text-white border-[#0F1923]'
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            <option value="">Alle sesjoner</option>
            {sesjoner.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <Sakstabell
        saker={filtrerteSaker}
        mandater={mandater}
        onKlikk={sak => router.push(`/sak/${sak.id}`)}
      />

      {/* Upcoming activities */}
      {aktiviteter.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-[#0F1923] mb-3">
            Kommende oppfølginger
            <span className="text-gray-400 font-normal ml-1">({aktiviteter.length})</span>
          </h2>
          <div className="space-y-2">
            {aktiviteter.slice(0, 10).map(a => {
              const fristDato = a.frist ? new Date(a.frist) : null
              const idag = new Date()
              idag.setHours(0, 0, 0, 0)
              const erForfalt = fristDato && fristDato < idag
              const erIdag = fristDato && fristDato.toDateString() === idag.toDateString()

              return (
                <div
                  key={a.id}
                  onClick={() => a.saker && router.push(`/sak/${a.saker.id}`)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className={`text-xs px-1.5 py-0.5 rounded ${
                    a.type === 'møte' ? 'bg-blue-100 text-blue-700' :
                    a.type === 'telefon' ? 'bg-green-100 text-green-700' :
                    a.type === 'e-post' ? 'bg-purple-100 text-purple-700' :
                    a.type === 'sosiale medier' ? 'bg-pink-100 text-pink-700' :
                    a.type === 'publisering' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {a.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#0F1923]">{a.beskrivelse}</span>
                    {a.saker && (
                      <span className="text-xs text-gray-400 ml-2">• {a.saker.tittel}</span>
                    )}
                  </div>
                  {fristDato && (
                    <span className={`text-xs shrink-0 ${
                      erForfalt ? 'text-red-600 font-medium' :
                      erIdag ? 'text-orange-600 font-medium' :
                      'text-gray-500'
                    }`}>
                      {fristDato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      {erForfalt && ' (forfalt)'}
                      {erIdag && ' (i dag)'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      </>}

      {/* Modal */}
      {modalSak !== undefined && (
        <SakModal
          sak={modalSak}
          komiteer={komiteer}
          onLagret={(sakId) => {
            const varImport = !!importertSak
            const tittel = importertSak?.korttittel || importertSak?.tittel || ''
            setModalSak(undefined)
            setImportertSak(null)
            invaliderSaker()
            // Vis delsaker-steg etter Stortinget-import
            if (varImport && sakId) {
              setDelsakerSteg({ sakId, tittel })
            }
          }}
          onLukk={() => {
            setModalSak(undefined)
            setImportertSak(null)
          }}
          importertStortingetSak={importertSak}
        />
      )}

      {/* Stortinget Import */}
      {visStortingetImport && (
        <StortingetImport
          onImporter={(stortingetSak) => {
            setVisStortingetImport(false)
            setImportertSak(stortingetSak)
            setModalSak(null) // null = ny sak, men med prefill fra importertSak
          }}
          onLukk={() => setVisStortingetImport(false)}
        />
      )}

      {/* Delsaker-steg etter Stortinget-import */}
      {delsakerSteg && (
        <DelsakerSteg
          forelderId={delsakerSteg.sakId}
          forelderTittel={delsakerSteg.tittel}
          onFerdig={() => {
            setDelsakerSteg(null)
            invaliderSaker()
          }}
          onLukk={() => {
            setDelsakerSteg(null)
          }}
        />
      )}
    </div>
  )
}
