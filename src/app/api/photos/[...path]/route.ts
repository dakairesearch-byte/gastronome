import { NextResponse } from 'next/server'

/**
 * Proxy for Google Places API v1 photo media.
 *
 * Why this exists: `enrichPlacesAndPhotos.ts` stores photo URLs in the
 * `restaurants.photo_url` / `photo_urls` columns as relative paths of
 * the form `/api/photos/places/<placeId>/photos/<photoRef>?w=1200`.
 * The expectation was that this Next.js route would proxy those
 * requests through to the Google Places Photo Media endpoint, but the
 * route was never built. Result: every <img> on a category page hit
 * /api/photos/... → 404, the request "succeeded" with the SPA HTML
 * fallback, and the browser rendered an empty image with
 * naturalWidth=0. The redesign exposed this because the old card
 * had no photo at all.
 *
 * Behavior:
 *  - The catch-all `[...path]` segment captures everything after
 *    `/api/photos/`, so `places/abc/photos/def` becomes the
 *    `photoName` Google's API expects (matches the same
 *    `places.<placeId>.photos.<photoRef>` shape).
 *  - We forward the request to:
 *      https://places.googleapis.com/v1/{photoName}/media
 *        ?maxWidthPx={w}&key={GOOGLE_PLACES_API_KEY}
 *    and stream the image bytes back to the browser.
 *  - We pin a long edge cache header (24h) because Google rotates
 *    photo URIs every ~hour anyway and the underlying photoRef
 *    is stable for as long as the place exists. This also lets
 *    Vercel's CDN soak up most of the load.
 *  - Server-side env var (`GOOGLE_PLACES_API_KEY`) is preferred so
 *    the key never reaches the client. Falls back to the public
 *    var if only that one is configured.
 */

export const runtime = 'nodejs'

const DEFAULT_MAX_WIDTH = 1200
const ALLOWED_WIDTHS = new Set([200, 320, 400, 600, 800, 1200, 1600])

// Google Places (New) photo names look like:
//   places/<placeId>/photos/<photoRef>
// where <placeId> and <photoRef> are opaque base64url-ish tokens. We accept
// only that exact 4-segment shape with conservative per-segment charsets so
// this proxy can't be coerced into hitting arbitrary upstream paths.
const PLACE_ID_RE = /^[A-Za-z0-9_-]{1,256}$/
const PHOTO_REF_RE = /^[A-Za-z0-9_-]{1,1024}$/

// ---------------------------------------------------------------------------
// Lightweight in-memory per-IP fixed-window rate limit (60 req/min).
//
// This is a *defense-in-depth* stopgap only: it is per-instance (each
// serverless instance keeps its own map) and resets on cold start. It does
// NOT replace the real controls, which are an OPS TASK:
//   - a hard Google Cloud billing cap / budget alert on the Places API key
//   - an edge / WAF rate limit (e.g. Vercel Firewall) in front of this route
// Configure both before relying on this proxy in production.
// ---------------------------------------------------------------------------
const RATE_LIMIT = 60
const WINDOW_MS = 60_000
const ipHits = new Map<string, { count: number; resetAt: number }>()

function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now >= entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistically evict expired buckets so the map can't grow unbounded.
    if (ipHits.size > 10_000) {
      for (const [k, v] of ipHits) if (now >= v.resetAt) ipHits.delete(k)
    }
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const ip = clientIp(request)
  if (isRateLimited(ip)) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  const { path } = await params
  // Strict shape check: exactly `places/<placeId>/photos/<photoRef>`. Anything
  // else (extra segments, wrong literals, illegal chars) is rejected before we
  // ever touch Google — each upstream call bills the account.
  if (
    !path ||
    path.length !== 4 ||
    path[0] !== 'places' ||
    path[2] !== 'photos' ||
    !PLACE_ID_RE.test(path[1]!) ||
    !PHOTO_REF_RE.test(path[3]!)
  ) {
    return new NextResponse('Bad photoName', { status: 400 })
  }
  // Reconstruct the Google photoName: `places/<placeId>/photos/<photoRef>`.
  // We re-encode each segment defensively in case the path was URL-encoded.
  const photoName = path.map((p) => encodeURIComponent(p)).join('/')

  const url = new URL(request.url)
  const requested = Number.parseInt(url.searchParams.get('w') ?? '', 10)
  // Bucket widths to a fixed allow-list so we can't be used as an open
  // arbitrary-width proxy (each unique width is a distinct cache key
  // upstream and burns Google quota).
  const maxWidthPx = ALLOWED_WIDTHS.has(requested) ? requested : DEFAULT_MAX_WIDTH

  const key =
    process.env.GOOGLE_PLACES_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  if (!key) {
    return new NextResponse('GOOGLE_PLACES_API_KEY not set', { status: 500 })
  }

  // Pass the API key as a header (never in the URL) and handle redirects
  // manually. Google's photo-media endpoint 302s to a signed CDN URL that
  // needs no key — following automatically would forward the key header to
  // the redirect target. We follow it ourselves, without the key, only to a
  // known Google host.
  const upstream =
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxWidthPx=${maxWidthPx}`

  const ALLOWED_REDIRECT_HOSTS = /(^|\.)(googleusercontent\.com|ggpht\.com|googleapis\.com|gstatic\.com)$/

  let res: Response
  try {
    res = await fetch(upstream, {
      redirect: 'manual',
      headers: { 'X-Goog-Api-Key': key },
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) {
        return new NextResponse('Upstream redirect without location', { status: 502 })
      }
      const redirectUrl = new URL(location)
      if (redirectUrl.protocol !== 'https:' || !ALLOWED_REDIRECT_HOSTS.test(redirectUrl.hostname)) {
        return new NextResponse('Upstream redirect to disallowed host', { status: 502 })
      }
      // Second hop carries no key — the signed CDN URL is self-authorizing.
      res = await fetch(redirectUrl, { redirect: 'manual' })
    }
  } catch (err) {
    return new NextResponse(
      `Upstream fetch failed: ${(err as Error).message}`,
      { status: 502 },
    )
  }

  if (!res.ok || !res.body) {
    // Pass through the upstream status so we don't cache failures.
    return new NextResponse(`Upstream ${res.status}`, { status: res.status })
  }

  // Stream the image bytes back. Vercel's CDN caches based on the
  // Cache-Control header below; once a (placeId, photoRef, width)
  // tuple is cached the upstream Google call doesn't recur until TTL.
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control':
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  })
}
