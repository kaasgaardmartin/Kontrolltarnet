'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const FANER = [
  { href: '/innstillinger', label: 'Komiteer', exact: true },
  { href: '/innstillinger/brukere', label: 'Brukere', adminOnly: true },
  { href: '/innstillinger/lovutvalg', label: 'Lovutvalg', adminOnly: true },
]

export default function InnstillingerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [erAdmin, setErAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('brukere')
          .select('rolle')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.rolle === 'org-admin') setErAdmin(true)
          })
      }
    })
  }, [])

  const synligeFaner = FANER.filter(f => !f.adminOnly || erAdmin)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F1923]">Innstillinger</h1>
        <p className="text-sm text-gray-500 mt-0.5">Administrer komiteer, brukere og lovutvalg</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {synligeFaner.map(fane => {
          const erAktiv = fane.exact
            ? pathname === fane.href
            : pathname.startsWith(fane.href)
          return (
            <Link
              key={fane.href}
              href={fane.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                erAktiv
                  ? 'border-[#4A9EDB] text-[#4A9EDB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {fane.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
