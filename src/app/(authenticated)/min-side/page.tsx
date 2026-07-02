'use client'

import { useState, useEffect } from 'react'
import { hentMinBrukerProfil, oppdaterEpostInnstillinger, sendTestMandagsliste } from '@/lib/actions'
import type { EpostInnstillinger } from '@/lib/actions'

type Profil = Awaited<ReturnType<typeof hentMinBrukerProfil>>

const ROLLE_LABEL: Record<string, string> = {
  'org-admin': 'Administrator',
  'redaktør': 'Redaktør',
  'leser': 'Leser',
}

const HENDELSEVARSLER: { key: keyof EpostInnstillinger; label: string; beskrivelse: string }[] = [
  {
    key: 'epost_horing_til_behandling',
    label: 'Høring til behandling',
    beskrivelse: 'Når en høring tildeles deg som ansvarlig',
  },
  {
    key: 'epost_oppgave_tildelt',
    label: 'Oppgave tildelt',
    beskrivelse: 'Når noen tildeler deg en ny oppgave i en sak',
  },
  {
    key: 'epost_fristpaminnelse',
    label: 'Fristpåminnelse',
    beskrivelse: 'Daglig påminnelse om oppgaver med kommende frister',
  },
  {
    key: 'epost_horingsfrist',
    label: 'Høringsfrist nærmer seg',
    beskrivelse: 'Påminnelse når høringsfristen er nær for saker du følger',
  },
  {
    key: 'epost_sakoppdatering',
    label: 'Saksoppdateringer',
    beskrivelse: 'Når det skjer endringer på saker du følger',
  },
]

function Toggle({
  på, lagrer, onToggle,
}: { på: boolean; lagrer: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={på}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9EDB] ${
        lagrer ? 'opacity-50 cursor-wait' : 'cursor-pointer'
      } ${på ? 'bg-[#4A9EDB]' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${på ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function MinSidePage() {
  const [profil, setProfil] = useState<Profil>(null)
  const [laster, setLaster] = useState(true)
  const [lagrer, setLagrer] = useState<keyof EpostInnstillinger | null>(null)
  const [feilmelding, setFeilmelding] = useState<string | null>(null)
  const [senderTest, setSenderTest] = useState(false)
  const [testStatus, setTestStatus] = useState<{ type: 'ok' | 'feil'; melding: string } | null>(null)

  useEffect(() => {
    hentMinBrukerProfil().then(data => { setProfil(data); setLaster(false) })
  }, [])

  async function toggle(key: keyof EpostInnstillinger) {
    if (!profil || lagrer) return
    const nyVerdi = !(profil[key as keyof typeof profil] as boolean)
    setProfil(prev => prev ? { ...prev, [key]: nyVerdi } : prev)
    setLagrer(key)
    setFeilmelding(null)
    const res = await oppdaterEpostInnstillinger({ [key]: nyVerdi })
    setLagrer(null)
    if (!res.success) {
      setProfil(prev => prev ? { ...prev, [key]: !nyVerdi } : prev)
      setFeilmelding('Kunne ikke lagre. Prøv igjen.')
    }
  }

  if (laster) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (!profil) return null

  const opprettetDato = profil.created_at
    ? new Date(profil.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const mandagsPå = !!(profil['epost_mandagsliste' as keyof typeof profil])

  async function testMandagsliste() {
    setSenderTest(true)
    setTestStatus(null)
    const res = await sendTestMandagsliste()
    setSenderTest(false)
    if (res.success) {
      setTestStatus({ type: 'ok', melding: `E-post sendt til deg med ${res.antall} høring${res.antall !== 1 ? 'er' : ''}` })
    } else {
      setTestStatus({ type: 'feil', melding: res.error ?? 'Noe gikk galt' })
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Min side</h1>

      {/* Profilkort */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#4A9EDB] flex items-center justify-center text-white text-xl font-semibold shrink-0">
            {profil.navn?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900">{profil.navn}</p>
            <p className="text-sm text-gray-500">{profil.epost}</p>
          </div>
          {profil.rolle && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#4A9EDB]/10 text-[#4A9EDB] font-medium">
              {ROLLE_LABEL[profil.rolle] ?? profil.rolle}
            </span>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
          {(profil.organisasjoner as unknown as { navn: string } | null)?.navn && (
            <span>{(profil.organisasjoner as unknown as { navn: string }).navn}</span>
          )}
          {opprettetDato && <span>Bruker siden {opprettetDato}</span>}
        </div>
      </div>

      {/* Mandagsliste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Ukentlig høringsoversikt</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                Mandager kl. 09:00
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              En oversikt over alle høringer som er til behandling hos utvalgene — med interne frister og høringsfrister.
              Sendes hver mandag morgen.
            </p>
          </div>
          <Toggle
            på={mandagsPå}
            lagrer={lagrer === 'epost_mandagsliste'}
            onToggle={() => toggle('epost_mandagsliste')}
          />
        </div>
        <div className="px-5 pb-4 flex items-center gap-3">
          <button
            onClick={testMandagsliste}
            disabled={senderTest}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {senderTest ? 'Sender…' : 'Send testmail til meg nå'}
          </button>
          {testStatus && (
            <span className={`text-xs ${testStatus.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
              {testStatus.melding}
            </span>
          )}
        </div>
      </div>

      {/* Hendelsevarsler */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Hendelsevarsler</h2>
          <p className="text-xs text-gray-500 mt-0.5">Velg hvilke hendelser du ønsker e-post om umiddelbart</p>
        </div>
        {HENDELSEVARSLER.map(({ key, label, beskrivelse }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{beskrivelse}</p>
            </div>
            <Toggle
              på={!!(profil[key as keyof typeof profil] as boolean)}
              lagrer={lagrer === key}
              onToggle={() => toggle(key)}
            />
          </div>
        ))}
      </div>

      {feilmelding && <p className="text-sm text-red-500">{feilmelding}</p>}
    </div>
  )
}
