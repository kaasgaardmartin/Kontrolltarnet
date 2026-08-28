'use client'

import { useState } from 'react'
import { useOvervakedeOrganisasjoner, useBrregEndringer, useInvaliderSakData } from '@/lib/queries'
import { leggTilOvervaketOrganisasjon, fjernOvervaketOrganisasjon, bulkLeggTilOrganisasjoner } from '@/lib/actions'
import type { NormalisertRolle } from '@/lib/brreg'

type Fane = 'oversikt' | 'endringslogg'

const ENDRING_IKON: Record<string, string> = {
  ny_rolle: '+',
  fjernet_rolle: '-',
  endring: '~',
}

const ENDRING_FARGE: Record<string, string> = {
  ny_rolle: 'text-green-700 bg-green-50 border-green-200',
  fjernet_rolle: 'text-red-700 bg-red-50 border-red-200',
  endring: 'text-amber-700 bg-amber-50 border-amber-200',
}

function formaterDato(dato: string): string {
  return new Date(dato).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formaterRelativDato(dato: string): string {
  const diff = Date.now() - new Date(dato).getTime()
  const dager = Math.floor(diff / 86_400_000)
  if (dager === 0) return 'I dag'
  if (dager === 1) return 'I går'
  if (dager < 7) return `${dager} dager siden`
  return new Date(dato).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export default function OrganisasjonerPage() {
  const [fane, setFane] = useState<Fane>('oversikt')
  const [visLeggTil, setVisLeggTil] = useState(false)
  const [visBulk, setVisBulk] = useState(false)
  const [orgnrInput, setOrgnrInput] = useState('')
  const [leggerTil, setLeggerTil] = useState(false)
  const [feilmelding, setFeilmelding] = useState('')
  const [sletter, setSletter] = useState<string | null>(null)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [bulkResultater, setBulkResultater] = useState<{ orgnr: string; navn: string | null; ok: boolean; feil?: string }[] | null>(null)
  const [bulkLaster, setBulkLaster] = useState(false)

  const { data: organisasjoner = [], isLoading } = useOvervakedeOrganisasjoner()
  const { data: endringer = [] } = useBrregEndringer()
  const { invaliderOrganisasjoner } = useInvaliderSakData()

  const SEED_ORGNUMRE = [
    '916782195','996918122','957423248','919513063','981371593',
    '984328796','986420177','935597404','994116177','920969798',
    '913296117','982409705','898783812','988371084','912056880',
    '947996053','934609255','991341129','925880426','919100265',
    '981459326','996798577','933326071','885719392','921027583',
    '916284055','965870016','959704996','817252532','947280740',
    '982470250','928739317','982370310','926311999','835700402',
    '992833424','923559841','912879461','991097171','929191811',
  ]

  async function handleLeggTil() {
    setFeilmelding('')
    setLeggerTil(true)
    const res = await leggTilOvervaketOrganisasjon(orgnrInput)
    setLeggerTil(false)
    if (res.success) {
      setOrgnrInput('')
      setVisLeggTil(false)
      invaliderOrganisasjoner()
    } else {
      setFeilmelding(res.error ?? 'Noe gikk galt')
    }
  }

  async function handleBulkImport() {
    setBulkLaster(true)
    setBulkResultater(null)
    const res = await bulkLeggTilOrganisasjoner(SEED_ORGNUMRE)
    setBulkLaster(false)
    if (res.success && res.resultater) {
      setBulkResultater(res.resultater)
      invaliderOrganisasjoner()
    } else {
      setFeilmelding(res.error ?? 'Noe gikk galt')
    }
  }

  async function handleFjern(id: string) {
    setSletter(id)
    const res = await fjernOvervaketOrganisasjon(id)
    setSletter(null)
    if (res.success) {
      invaliderOrganisasjoner()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-[#4A9EDB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F1923]">Organisasjoner</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Overvåk endringer i styre og ledelse via Brønnøysundregistrene
          </p>
        </div>
        <div className="flex items-center gap-2">
          {organisasjoner.length === 0 && (
            <button
              onClick={() => { setVisBulk(true); setFeilmelding('') }}
              disabled={bulkLaster}
              className="px-4 py-2 border border-[#4A9EDB] text-[#4A9EDB] rounded-lg text-sm font-medium hover:bg-[#4A9EDB]/10 disabled:opacity-50 transition-colors"
            >
              Importer 40 advokatfirmaer
            </button>
          )}
          <button
            onClick={() => { setVisLeggTil(true); setFeilmelding('') }}
            className="px-4 py-2 bg-[#4A9EDB] text-white rounded-lg text-sm font-medium hover:bg-[#3a8ecb] transition-colors"
          >
            Legg til organisasjon
          </button>
        </div>
      </div>

      {/* Add dialog */}
      {visLeggTil && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-[#0F1923] mb-3">Legg til organisasjon</h3>
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Organisasjonsnummer (9 siffer)"
              value={orgnrInput}
              onChange={e => setOrgnrInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !leggerTil && handleLeggTil()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A9EDB]/30 focus:border-[#4A9EDB]"
            />
            <button
              onClick={handleLeggTil}
              disabled={leggerTil || orgnrInput.replace(/\s/g, '').length < 9}
              className="px-4 py-2 bg-[#4A9EDB] text-white rounded-lg text-sm font-medium hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors"
            >
              {leggerTil ? 'Slår opp...' : 'Legg til'}
            </button>
            <button
              onClick={() => { setVisLeggTil(false); setOrgnrInput(''); setFeilmelding('') }}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              Avbryt
            </button>
          </div>
          {feilmelding && (
            <p className="mt-2 text-sm text-red-600">{feilmelding}</p>
          )}
        </div>
      )}

      {/* Bulk import panel */}
      {visBulk && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-[#0F1923] mb-2">Importer advokatfirmaer</h3>
          {!bulkResultater ? (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Legger til 40 norske advokatfirmaer med oppslag mot Brønnøysundregistrene.
                Dette kan ta et par minutter.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkImport}
                  disabled={bulkLaster}
                  className="px-4 py-2 bg-[#4A9EDB] text-white rounded-lg text-sm font-medium hover:bg-[#3a8ecb] disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {bulkLaster && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {bulkLaster ? 'Importerer...' : 'Start import'}
                </button>
                <button
                  onClick={() => { setVisBulk(false); setBulkResultater(null) }}
                  disabled={bulkLaster}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm disabled:opacity-50 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-green-600 font-medium">
                  {bulkResultater.filter(r => r.ok).length} lagt til
                </span>
                {bulkResultater.some(r => !r.ok) && (
                  <span className="text-sm text-red-600 font-medium">
                    {bulkResultater.filter(r => !r.ok).length} feilet
                  </span>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {bulkResultater.map((r, i) => (
                  <div key={i} className={`px-3 py-2 text-sm flex items-center justify-between ${r.ok ? '' : 'bg-red-50/50'}`}>
                    <span className={r.ok ? 'text-gray-700' : 'text-red-700'}>
                      {r.navn ?? r.orgnr}
                    </span>
                    {r.ok ? (
                      <span className="text-green-500 text-xs font-medium">OK</span>
                    ) : (
                      <span className="text-red-500 text-xs">{r.feil}</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setVisBulk(false); setBulkResultater(null) }}
                className="mt-3 px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Lukk
              </button>
            </div>
          )}
          {feilmelding && (
            <p className="mt-2 text-sm text-red-600">{feilmelding}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'oversikt' as Fane, label: 'Oversikt', count: organisasjoner.length },
          { key: 'endringslogg' as Fane, label: 'Endringslogg', count: endringer.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFane(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              fane === tab.key
                ? 'border-[#4A9EDB] text-[#4A9EDB]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Oversikt-fane */}
      {fane === 'oversikt' && (
        <div>
          {organisasjoner.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Ingen organisasjoner lagt til ennå</p>
              <p className="text-xs text-gray-400 mt-1">Klikk &ldquo;Legg til organisasjon&rdquo; for å komme i gang</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {organisasjoner.map((org: Record<string, unknown>) => {
                const snapshot = org.brreg_roller_snapshot as { roller: NormalisertRolle[]; hentet_dato: string } | null
                const roller = (snapshot?.roller ?? []) as NormalisertRolle[]
                const aktiveRoller = roller.filter(r => !r.fratraadt)
                const nokkelRoller = aktiveRoller.filter(r =>
                  ['Styrets leder', 'Daglig leder', 'Nestleder', 'Styreleder'].some(
                    k => r.rolletype.toLowerCase().includes(k.toLowerCase())
                  )
                )
                const ovrigeRoller = aktiveRoller.filter(r => !nokkelRoller.includes(r))
                const isExpanded = expandedOrg === (org.id as string)

                return (
                  <div
                    key={org.id as string}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-[#0F1923]">
                            {org.navn as string}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Org.nr: {org.orgnr as string}
                            {snapshot?.hentet_dato && (
                              <span className="ml-3">
                                Sist sjekket: {formaterRelativDato(snapshot.hentet_dato)}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleFjern(org.id as string)}
                          disabled={sletter === (org.id as string)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          title="Fjern organisasjon"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>

                      {/* Key roles */}
                      {nokkelRoller.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nokkelRoller.map((rolle, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4A9EDB]/10 text-sm"
                            >
                              <span className="text-[#4A9EDB] font-medium">{rolle.rolletype}:</span>
                              <span className="text-[#0F1923]">{rolle.personnavn}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {aktiveRoller.length === 0 && snapshot && (
                        <p className="mt-3 text-sm text-gray-400 italic">Ingen aktive roller registrert</p>
                      )}
                      {!snapshot && (
                        <p className="mt-3 text-sm text-gray-400 italic">Henter roller...</p>
                      )}

                      {/* Expand/collapse other roles */}
                      {ovrigeRoller.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedOrg(isExpanded ? null : (org.id as string))}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                            {ovrigeRoller.length} {ovrigeRoller.length === 1 ? 'annen rolle' : 'andre roller'}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 grid gap-1">
                              {ovrigeRoller.map((rolle, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-gray-600 pl-4">
                                  <span className="text-gray-400">{rolle.rolletype}:</span>
                                  <span>{rolle.personnavn}</span>
                                  <span className="text-xs text-gray-300">({rolle.rollegruppe})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Endringslogg-fane */}
      {fane === 'endringslogg' && (
        <div>
          {endringer.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-sm text-gray-500">Ingen endringer registrert ennå</p>
              <p className="text-xs text-gray-400 mt-1">Endringer oppdages automatisk ved daglig sjekk kl. 08:00</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {endringer.map((endring: Record<string, unknown>) => (
                  <div key={endring.id as string} className="px-5 py-3.5 flex items-start gap-3">
                    <span
                      className={`mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center text-sm font-mono font-bold shrink-0 ${
                        ENDRING_FARGE[endring.endring_type as string] ?? 'text-gray-500 bg-gray-50 border-gray-200'
                      }`}
                    >
                      {ENDRING_IKON[endring.endring_type as string] ?? '?'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F1923]">{endring.beskrivelse as string}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{endring.org_navn as string}</span>
                        <span className="text-xs text-gray-300">&middot;</span>
                        <span className="text-xs text-gray-400">
                          {formaterDato(endring.oppdaget_dato as string)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
