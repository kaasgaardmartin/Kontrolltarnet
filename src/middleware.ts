import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware'
import { rateLimit } from '@/lib/rate-limit'

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting for API-ruter: 60 req/min per IP
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request)
    const result = rateLimit(`api:${ip}`, 60)

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Prøv igjen senere.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.retryAfterMs ?? 60_000) / 1000)),
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }
  }

  // Rate limiting for login: 10 forsøk/min per IP (brute force-beskyttelse)
  if (pathname === '/login' && request.method === 'POST') {
    const ip = getClientIp(request)
    const result = rateLimit(`login:${ip}`, 10)

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'For mange innloggingsforsøk. Vent litt.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.retryAfterMs ?? 60_000) / 1000)),
          },
        }
      )
    }
  }

  // Auth-sjekk (eksisterende logikk)
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
