// In-memory rate limiter med sliding window
// Ingen ekstra avhengigheter — fungerer for single-instance deploys (Vercel serverless).
// OBS: Hver serverless-funksjon har sin egen instans, så rate limiting er
// per-instans, ikke global. For strengere rate limiting ved høy trafikk,
// vurder Vercel KV (Redis) eller Upstash: https://upstash.com/blog/nextjs-rate-limiting

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Rydd opp gamle entries hvert 5. minutt for å unngå minnelekkasje
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 60_000)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL)

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number | null
}

/**
 * Sjekk om en forespørsel er tillatt.
 * @param key   Unik nøkkel (f.eks. IP-adresse)
 * @param limit Maks antall forespørsler per vindu
 * @param windowMs Tidsvindu i millisekunder (default 60s)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Fjern timestamps utenfor vinduet
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = windowMs - (now - oldestInWindow)
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterMs: null,
  }
}
