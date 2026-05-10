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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  if (!path || path.length < 2) {
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

  const upstream =
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxWidthPx=${maxWidthPx}&key=${key}`

  let res: Response
  try {
    res = await fetch(upstream, { redirect: 'follow' })
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
