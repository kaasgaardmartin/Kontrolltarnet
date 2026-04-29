'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hentVarsler, markerVarselLest, markerAlleVarslerLest } from '@/lib/actions'
import { useUlesteVarsler, useInvaliderSakData } from '@/lib/queries'
import type { User } from '@supabase/supabase-js'
import type { Varsel, VarselType } from '@/lib/types'

interface BrukerData {
  id: string
  navn: string
  epost: string
  rolle: string
  organisasjoner: { navn: string } | null
}

const VARSEL_IKON: Record<VarselType, string> = {
  notat: '💬',
  landing: '🔄',
  utfall: '⚖️',
  aktivitet: '📋',
  frist: '⏰',
  tildelt: '👤',
}

function tidSiden(dato: string): string {
  const diff = Date.now() - new Date(dato).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'nå'
  if (min < 60) return `${min} min`
  const timer = Math.floor(min / 60)
  if (timer < 24) return `${timer}t`
  const dager = Math.floor(timer / 24)
  return `${dager}d`
}

export default function Toppmeny() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [bruker, setBruker] = useState<BrukerData | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showVarsler, setShowVarsler] = useState(false)
  const [varsler, setVarsler] = useState<Varsel[]>([])
  const { data: uleste = 0 } = useUlesteVarsler()
  const { invaliderVarsler } = useInvaliderSakData()
  const profileRef = useRef<HTMLDivElement>(null)
  const varselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase
          .from('brukere')
          .select('id, navn, epost, rolle, organisasjoner(navn)')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setBruker(data as unknown as BrukerData)
          })
      }
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
      }
      if (varselRef.current && !varselRef.current.contains(e.target as Node)) {
        setShowVarsler(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleOpenVarsler() {
    setShowVarsler(!showVarsler)
    setShowProfile(false)
    if (!showVarsler) {
      const data = await hentVarsler()
      setVarsler(data)
    }
  }

  async function handleVarselKlikk(varsel: Varsel) {
    if (!varsel.lest) {
      await markerVarselLest(varsel.id)
      setVarsler(prev => prev.map(v => v.id === varsel.id ? { ...v, lest: true } : v))
      invaliderVarsler()
    }
    setShowVarsler(false)
    if (varsel.sak_id) {
      router.push(`/sak/${varsel.sak_id}`)
    }
  }

  async function handleMarkerAlleLest() {
    await markerAlleVarslerLest()
    setVarsler(prev => prev.map(v => ({ ...v, lest: true })))
    invaliderVarsler()
  }

  const erOrgAdmin = bruker?.rolle === 'org-admin'

  const navItems = [
    { href: '/', label: 'Stortinget' },
    { href: '/horinger', label: 'Høringer' },
    { href: '/mine-oppgaver', label: 'Mine oppgaver' },
    { href: '/admin', label: 'Komiteer' },
    ...(erOrgAdmin ? [{ href: '/admin/brukere', label: 'Brukere' }] : []),
  ]

  return (
    <header className="bg-[#0F1923] text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-semibold text-base">
              <svg
                className="w-5 h-5 text-[#4A9EDB]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Gavl */}
                <path d="M2 10L12 3L22 10" />
                {/* 5 søyler */}
                <line x1="5" y1="10" x2="5" y2="18" />
                <line x1="8.5" y1="10" x2="8.5" y2="18" />
                <line x1="12" y1="10" x2="12" y2="18" />
                <line x1="15.5" y1="10" x2="15.5" y2="18" />
                <line x1="19" y1="10" x2="19" y2="18" />
                {/* Søylebase */}
                <line x1="3" y1="18" x2="21" y2="18" />
                {/* Trapper */}
                <line x1="2" y1="20" x2="22" y2="20" />
                <line x1="1" y1="22" x2="23" y2="22" />
              </svg>
              Tingsyn
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                      ? 'bg-[#4A9EDB]/20 text-[#4A9EDB]'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: org name + notifications + avatar */}
          <div className="flex items-center gap-4">
            {bruker?.organisasjoner && (
              <span className="text-xs text-gray-400 hidden sm:block">
                {bruker.organisasjoner.navn}
              </span>
            )}

            {/* Notification bell */}
            <div className="relative" ref={varselRef}>
              <button
                onClick={handleOpenVarsler}
                className="relative p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {uleste > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
                    {uleste > 99 ? '99+' : uleste}
                  </span>
                )}
              </button>

              {showVarsler && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 text-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <h3 className="text-sm font-semibold">Varsler</h3>
                    {uleste > 0 && (
                      <button
                        onClick={handleMarkerAlleLest}
                        className="text-xs text-[#4A9EDB] hover:underline"
                      >
                        Marker alle som lest
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {varsler.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">
                        Ingen varsler ennå
                      </div>
                    ) : (
                      varsler.map(varsel => (
                        <button
                          key={varsel.id}
                          onClick={() => handleVarselKlikk(varsel)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                            !varsel.lest ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <span className="text-base shrink-0 mt-0.5">{VARSEL_IKON[varsel.type]}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${!varsel.lest ? 'font-medium' : 'text-gray-600'}`}>
                              {varsel.melding}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {varsel.saker?.tittel && (
                                <span className="text-xs text-gray-400 truncate">{varsel.saker.tittel}</span>
                              )}
                              <span className="text-xs text-gray-300 shrink-0">{tidSiden(varsel.created_at)}</span>
                            </div>
                          </div>
                          {!varsel.lest && (
                            <span className="w-2 h-2 rounded-full bg-[#4A9EDB] shrink-0 mt-2" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfile(!showProfile); setShowVarsler(false) }}
                className="w-8 h-8 rounded-full bg-[#4A9EDB] flex items-center justify-center text-sm font-medium hover:bg-[#3a8ecb] transition-colors"
              >
                {bruker?.navn?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 text-gray-800">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium">{bruker?.navn || 'Bruker'}</p>
                    <p className="text-xs text-gray-500">{bruker?.epost || user?.email}</p>
                    {bruker?.rolle && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-[#4A9EDB]/10 text-[#4A9EDB] capitalize">
                        {bruker.rolle}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Logg ut
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
