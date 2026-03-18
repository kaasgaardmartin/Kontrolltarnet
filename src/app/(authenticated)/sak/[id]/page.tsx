'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PARTIER, type Stemme } from '@/lib/types'
import { arkiverSak, registrerUtfall, toggleSakAbonnement, type SakMedStemmer } from '@/lib/actions'
import { beregnFlertall, harOmvendtFlertall, type PartiStemme as FlertallPartiStemme } from '@/lib/flertall'
import { useSak, useMandater, useKomiteMandater, useKomiteer, useOrgBrukere, useSakAbonnement, useInvaliderSakData } from '@/lib/queries'
import NotatSeksjon from '@/components/NotatSeksjon'
import LenkeSeksjon from '@/components/LenkeSeksjon'
import StakeholderSeksjon from '@/components/StakeholderSeksjon'
import AktivitetSeksjon from '@/components/AktivitetSeksjon'
import SakModal from '@/components/SakModal'

const STEMME_STIL: Record<Stemme, { bg: string; text: string; label: string }> = {
  for: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'For' },
  mot: { bg: 'bg-red-100', text: 'text-red-700', label: 'Mot' },
  ukjent: { bg: 'bg-gray-50', text: 'text-gray-400', label: 'Ukjent' },
}

const LANDING_STIL: Record<string, { bg: string; text: string }> = {
  vedtas: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  faller: { bg: 'bg-red-100', text: 'text-red-700' },
  usikkert: { bg: 'bg-amber-100', text: 'text-amber-700' },
  ukjent: { bg: 'bg-gray-100', text: 'text-gray-500' },
  vedtatt: { bg: 'bg-blue-100', text: 'text-blue-700' },
}

const NIVA_LABEL: Record<string, string> = {
  storting: 'Storting',
  departement: 'Departement',
  intern: 'Intern',
}

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function SakDetaljSide() {
  const params = useParams()
  const router = useRouter()
  const sakId = params.id as string

  const [visModal, setVisModal] = useState(false)
  const [visDelsakModal, setVisDelsakModal] = useState(false)
  const [redigerDelsak, setRedigerDelsak] = useState<SakMedStemmer | null>(null)
  const [bekreftArkiver, setBekreftArkiver] = useState(false)
  const [registrererUtfall, setRegistrererUtfall] = useState(false)

  const { invaliderSak, invaliderSaker, invaliderVarsler } = useInvaliderSakData()

  // React Query hooks — cached data deles med andre sider
  const { data: sak, isLoading: lasterSak } = useSak(sakId)
  const { data: mandater = [] } = useMandater()
  const { data: komiteer = [] } = useKomiteer()
  const { data: orgBrukere = [] } = useOrgBrukere()
  const { data: komiteMandater = [] } = useKomiteMandater(sak?.komite_id)
  const { data: foelger = false } = useSakAbonnement(sakId)

  const lastData = () => invaliderSak(sakId)

  if (lasterSak) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-gray-400">Laster...</div>
      </div>
    )
  }

  if (!sak) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Saken ble ikke funnet</p>
        <button onClick={() => router.push('/')} className="text-sm text-[#4A9EDB] hover:underline mt-2">
          Tilbake til oversikten
        </button>
      </div>
    )
  }

  const landing = sak.landing || 'ukjent'
  const landingStil = LANDING_STIL[landing] || LANDING_STIL.ukjent

  // Flertallsberegning
  const stemmerForBeregning: FlertallPartiStemme[] = PARTIER.map(p => {
    const found = sak.partistemmer.find(s => s.parti === p)
    return { parti: p, stemme: (found?.stemme as Stemme) || 'ukjent' }
  })
  const flertall = mandater.length > 0 ? beregnFlertall(stemmerForBeregning, mandater) : null
  const komiteFlertall = komiteMandater.length > 0 ? beregnFlertall(stemmerForBeregning, komiteMandater) : null
  const omvendtFlertall = flertall && komiteFlertall ? harOmvendtFlertall(komiteFlertall, flertall) : false

  async function handleToggleFoelg() {
    await toggleSakAbonnement(sakId)
    invaliderSak(sakId)
  }

  async function handleUtfall(utfall: 'vedtatt' | 'ikke_vedtatt' | null) {
    setRegistrererUtfall(true)
    await registrerUtfall(sakId, utfall)
    invaliderSak(sakId)
    invaliderVarsler()
    setRegistrererUtfall(false)
  }

  async function handleArkiver() {
    await arkiverSak(sakId)
    invaliderSaker()
    router.push('/')
  }

  // Convert SakDetaljer to SakMedStemmer for the modal
  const sakForModal: SakMedStemmer = {
    ...sak,
    partistemmer: sak.partistemmer,
  }

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={() => {
          if (sak.forelder_id) {
            router.push(`/sak/${sak.forelder_id}`)
          } else {
            router.push('/')
          }
        }}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {sak.forelder_id ? 'Tilbake til hovedsaken' : 'Tilbake til oversikten'}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          {sak.forelder_id && (
            <span className="text-xs text-gray-400 uppercase tracking-wide">Delsak</span>
          )}
          <h1 className="text-xl font-bold text-[#0F1923] mb-1">{sak.tittel}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {sak.niva && (
              <span className="text-xs text-gray-500">{NIVA_LABEL[sak.niva] || sak.niva}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${landingStil.bg} ${landingStil.text}`}>
              {landing}
            </span>
            {sak.komiteer && (
              <span className="text-xs text-gray-400">{sak.komiteer.navn}</span>
            )}
            {sak.sesjon && (
              <span className="text-xs text-gray-400">{sak.sesjon}</span>
            )}
            {sak.stortingssak_ref && sak.stortingssak_ref.startsWith('http') && (
              <a
                href={sak.stortingssak_ref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#4A9EDB] hover:underline inline-flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.343 8.28" />
                </svg>
                {getDomainFromUrl(sak.stortingssak_ref)}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={handleToggleFoelg}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              foelger
                ? 'border-[#4A9EDB] text-[#4A9EDB] bg-[#4A9EDB]/5 hover:bg-[#4A9EDB]/10'
                : 'border-gray-300 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill={foelger ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            {foelger ? 'Følger' : 'Følg'}
          </button>
          <button
            onClick={() => setVisModal(true)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Rediger
          </button>
          {!bekreftArkiver ? (
            <button
              onClick={() => setBekreftArkiver(true)}
              className="px-3 py-1.5 text-sm text-amber-600 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
            >
              Arkiver
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleArkiver}
                className="px-3 py-1.5 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600"
              >
                Bekreft
              </button>
              <button
                onClick={() => setBekreftArkiver(false)}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Avbryt
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Beskrivelse */}
      {sak.beskrivelse && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{sak.beskrivelse}</p>
        </div>
      )}

      {/* Datoer */}
      {(sak.komite_dato || sak.stortings_dato) && (
        <div className="flex items-center gap-4 mb-4">
          {sak.komite_dato && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Komitédato:</span>{' '}
              {new Date(sak.komite_dato).toLocaleDateString('nb-NO')}
            </div>
          )}
          {sak.stortings_dato && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Stortingsdato:</span>{' '}
              {new Date(sak.stortings_dato).toLocaleDateString('nb-NO')}
            </div>
          )}
        </div>
      )}

      {/* Utfall */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F1923]">Utfall</h3>
          {sak.utfall && (
            <button
              onClick={() => handleUtfall(null)}
              disabled={registrererUtfall}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Fjern utfall
            </button>
          )}
        </div>
        {sak.utfall ? (
          <div className="mt-2 flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${
              sak.utfall === 'vedtatt'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {sak.utfall === 'vedtatt' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {sak.utfall === 'vedtatt' ? 'Vedtatt' : 'Ikke vedtatt'}
            </span>
            {sak.utfall_dato && (
              <span className="text-xs text-gray-400">
                {new Date(sak.utfall_dato).toLocaleDateString('nb-NO')}
              </span>
            )}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">Marker utfall:</span>
            <button
              onClick={() => handleUtfall('vedtatt')}
              disabled={registrererUtfall}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              Vedtatt
            </button>
            <button
              onClick={() => handleUtfall('ikke_vedtatt')}
              disabled={registrererUtfall}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Ikke vedtatt
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Partistemmer + Flertall + Delsaker */}
        <div className="lg:col-span-2 space-y-4">
          {/* Partistemmer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-[#0F1923] mb-3">Partistemmer</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PARTIER.map(parti => {
                const found = sak.partistemmer.find(s => s.parti === parti)
                const stemme = (found?.stemme as Stemme) || 'ukjent'
                const stil = STEMME_STIL[stemme]
                return (
                  <div key={parti} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${stil.bg}`}>
                    <span className="text-sm font-medium text-gray-700">{parti}</span>
                    <span className={`text-xs ${stil.text}`}>{stil.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Flertall */}
            {(komiteFlertall || flertall) && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Flertall</h4>

                {komiteFlertall && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0">{sak.komiteer?.navn || 'Komité'}</span>
                    <div className="flex-1">
                      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                        {komiteFlertall.forMandater > 0 && (
                          <div className="bg-emerald-400" style={{ width: `${komiteFlertall.prosentFor}%` }} />
                        )}
                        {komiteFlertall.motMandater > 0 && (
                          <div className="bg-red-400" style={{ width: `${komiteFlertall.prosentMot}%` }} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">
                        {komiteFlertall.forMandater}/{komiteFlertall.motMandater}
                        {komiteFlertall.ukjentMandater > 0 && <span className="text-gray-300">/{komiteFlertall.ukjentMandater}</span>}
                      </span>
                      <span className={`text-xs font-medium ${
                        komiteFlertall.harFlertall === 'for' ? 'text-emerald-600' :
                        komiteFlertall.harFlertall === 'mot' ? 'text-red-600' :
                        'text-gray-400'
                      }`}>
                        {komiteFlertall.harFlertall === 'for' ? 'FOR' :
                         komiteFlertall.harFlertall === 'mot' ? 'MOT' : '?'}
                      </span>
                    </div>
                  </div>
                )}

                {flertall && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0">Stortinget</span>
                    <div className="flex-1">
                      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                        {flertall.forMandater > 0 && (
                          <div className="bg-emerald-400" style={{ width: `${flertall.prosentFor}%` }} />
                        )}
                        {flertall.motMandater > 0 && (
                          <div className="bg-red-400" style={{ width: `${flertall.prosentMot}%` }} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">
                        {flertall.forMandater}/{flertall.motMandater}
                        {flertall.ukjentMandater > 0 && <span className="text-gray-300">/{flertall.ukjentMandater}</span>}
                      </span>
                      <span className={`text-xs font-medium ${
                        flertall.harFlertall === 'for' ? 'text-emerald-600' :
                        flertall.harFlertall === 'mot' ? 'text-red-600' :
                        'text-gray-400'
                      }`}>
                        {flertall.harFlertall === 'for' ? 'FOR' :
                         flertall.harFlertall === 'mot' ? 'MOT' : '?'}
                      </span>
                    </div>
                  </div>
                )}

                {omvendtFlertall && (
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <span className="text-xs text-amber-700">Omvendt flertall — komiteen og Stortinget peker i ulik retning</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delsaker */}
          {!sak.forelder_id && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#0F1923]">
                  Delsaker
                  {sak.delsaker && sak.delsaker.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">({sak.delsaker.length})</span>
                  )}
                </h3>
                <button
                  onClick={() => setVisDelsakModal(true)}
                  className="text-xs text-[#4A9EDB] hover:text-[#3a8ecb] transition-colors"
                >
                  + Legg til delsak
                </button>
              </div>

              {sak.delsaker && sak.delsaker.length > 0 ? (
                <div className="space-y-2">
                  {sak.delsaker.map(delsak => {
                    const delLanding = delsak.landing || 'ukjent'
                    const delLandingStil = LANDING_STIL[delLanding] || LANDING_STIL.ukjent
                    const delStemmer: FlertallPartiStemme[] = PARTIER.map(p => {
                      const found = delsak.partistemmer.find(s => s.parti === p)
                      return { parti: p, stemme: (found?.stemme as Stemme) || 'ukjent' }
                    })
                    const delFlertall = mandater.length > 0 ? beregnFlertall(delStemmer, mandater) : null

                    return (
                      <div
                        key={delsak.id}
                        onClick={() => router.push(`/sak/${delsak.id}`)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#0F1923] truncate">{delsak.tittel}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${delLandingStil.bg} ${delLandingStil.text}`}>
                              {delLanding}
                            </span>
                            {/* Mini party vote indicators */}
                            <div className="flex gap-0.5">
                              {PARTIER.map(p => {
                                const found = delsak.partistemmer.find(s => s.parti === p)
                                const stemme = (found?.stemme as Stemme) || 'ukjent'
                                const stil = STEMME_STIL[stemme]
                                return (
                                  <span key={p} className={`inline-block w-2 h-2 rounded-sm ${stil.bg}`} title={`${p}: ${stemme}`} />
                                )
                              })}
                            </div>
                          </div>
                        </div>
                        {delFlertall && (
                          <div className={`text-xs font-medium ${
                            delFlertall.harFlertall === 'for' ? 'text-emerald-600' :
                            delFlertall.harFlertall === 'mot' ? 'text-red-600' :
                            'text-gray-400'
                          }`}>
                            {delFlertall.forMandater}/{delFlertall.motMandater}
                          </div>
                        )}
                        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Ingen delsaker ennå. Legg til delsaker for å spore enkeltvedtak.</p>
              )}
            </div>
          )}

          {/* Stakeholders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <StakeholderSeksjon
              sakId={sakId}
              sakStakeholders={sak.sak_stakeholders ?? []}
              onOppdatert={lastData}
              kanRedigere={true}
            />
          </div>

          {/* Aktiviteter / Oppfølging */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <AktivitetSeksjon
              sakId={sakId}
              aktiviteter={sak.aktiviteter ?? []}
              sakStakeholders={sak.sak_stakeholders ?? []}
              brukere={orgBrukere}
              onOppdatert={lastData}
              kanRedigere={true}
            />
          </div>
        </div>

        {/* Right sidebar: Noter + Lenker */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <LenkeSeksjon
              sakId={sakId}
              lenker={sak.lenker}
              onOppdatert={lastData}
              kanRedigere={true}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <NotatSeksjon
              sakId={sakId}
              noter={sak.noter}
              onOppdatert={lastData}
              kanRedigere={true}
            />
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {visModal && (
        <SakModal
          sak={sakForModal}
          komiteer={komiteer}
          onLagret={() => {
            setVisModal(false)
            invaliderSak(sakId)
            invaliderSaker()
          }}
          onLukk={() => setVisModal(false)}
        />
      )}

      {/* New delsak modal */}
      {visDelsakModal && (
        <SakModal
          sak={null}
          komiteer={komiteer}
          forelderId={sakId}
          forelderData={{
            stortingssak_ref: sak.stortingssak_ref,
            komite_id: sak.komite_id,
            komite_dato: sak.komite_dato,
            stortings_dato: sak.stortings_dato,
            niva: sak.niva,
            sesjon: sak.sesjon,
          }}
          onLagret={() => {
            setVisDelsakModal(false)
            invaliderSak(sakId)
            invaliderSaker()
          }}
          onLukk={() => setVisDelsakModal(false)}
        />
      )}

      {/* Edit delsak modal */}
      {redigerDelsak && (
        <SakModal
          sak={redigerDelsak}
          komiteer={komiteer}
          onLagret={() => {
            setRedigerDelsak(null)
            invaliderSak(sakId)
            invaliderSaker()
          }}
          onLukk={() => setRedigerDelsak(null)}
        />
      )}
    </div>
  )
}
