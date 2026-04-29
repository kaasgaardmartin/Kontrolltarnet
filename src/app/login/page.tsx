'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth'
// import { signInWithAzure } from '@/lib/auth-azure' // Uncomment for Azure AD

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [navn, setNavn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (isSignUp) {
      if (password.length < 8) {
        setError('Passordet må være minst 8 tegn.')
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setError('Passordene stemmer ikke overens.')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, navn)
      if (error) {
        setError(error.message)
      } else {
        setMessage('Sjekk e-posten din for bekreftelseslenke.')
      }
    } else {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    }

    setLoading(false)
  }

  /*
  // Azure AD login handler - uncomment when switching to Azure AD
  async function handleAzureLogin() {
    setError(null)
    const { error } = await signInWithAzure()
    if (error) setError(error.message)
  }
  */

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F1923] mb-4">
            <svg
              className="w-9 h-9 text-[#4A9EDB]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Gavl / pediment */}
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
          </div>
          <h1 className="text-2xl font-bold text-[#0F1923]">Tingsyn</h1>
          <p className="text-sm text-gray-500 mt-1">Politisk saksoppfølging</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-[#0F1923] mb-6">
            {isSignUp ? 'Opprett konto' : 'Logg inn'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="navn" className="block text-sm font-medium text-gray-700 mb-1">
                  Fullt navn
                </label>
                <input
                  id="navn"
                  type="text"
                  value={navn}
                  onChange={(e) => setNavn(e.target.value)}
                  required={isSignUp}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                  placeholder="Ola Nordmann"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-post
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                placeholder="din@epost.no"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Passord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isSignUp ? 8 : 6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent"
                placeholder={isSignUp ? 'Minst 8 tegn' : 'Passord'}
              />
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Bekreft passord
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A9EDB] focus:border-transparent ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  placeholder="Skriv passordet på nytt"
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500 mt-1">Passordene stemmer ikke overens</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#4A9EDB] hover:bg-[#3a8ecb] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Vennligst vent...' : isSignUp ? 'Opprett konto' : 'Logg inn'}
            </button>
          </form>

          {/*
          // Azure AD button - uncomment when switching to Azure AD
          <div className="mt-4">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">eller</span>
              </div>
            </div>
            <button
              onClick={handleAzureLogin}
              className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 21 21">
                <path fill="#f25022" d="M1 1h9v9H1z"/>
                <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                <path fill="#7fba00" d="M11 1h9v9h-9z"/>
                <path fill="#ffb900" d="M11 11h9v9h-9z"/>
              </svg>
              Logg inn med Microsoft
            </button>
          </div>
          */}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setMessage(null)
                setConfirmPassword('')
              }}
              className="text-sm text-[#4A9EDB] hover:underline"
            >
              {isSignUp ? 'Har du allerede en konto? Logg inn' : 'Ny bruker? Opprett konto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
