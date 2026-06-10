import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

// Regenerate daily (ISR) so newly-added restaurants/cities appear without a
// redeploy, while keeping the route cacheable rather than dynamic-per-request.
export const revalidate = 86400

/**
 * Dynamic sitemap (Next.js 16 `sitemap.ts` convention).
 *
 * Enumerates the static browse routes plus every restaurant route pulled
 * live from Supabase. Resilient by design: if the query fails (DB outage,
 * missing env at build time), we fall back to the static route set rather
 * than throwing and producing no sitemap at all.
 *
 * `metadataBase` (set in layout.tsx) does NOT apply to sitemap URLs —
 * the spec requires absolute `<loc>` values, so we build them from
 * NEXT_PUBLIC_SITE_URL here.
 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

type StaticRoute = {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  // /explore and /search are permanent redirects to /discover
  // (next.config.ts) — a sitemap must list the canonical URL, not 308s.
  { path: '/discover', changeFrequency: 'daily', priority: 0.9 },
  { path: '/recent', changeFrequency: 'daily', priority: 0.7 },
  { path: '/community', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  const dynamicEntries: MetadataRoute.Sitemap = []

  try {
    // Cookieless anon client: a sitemap is public, cacheable data — using the
    // cookie-based server client would force the route dynamic-per-request and
    // break static generation. Public-read RLS covers restaurants + cities.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) throw new Error('Supabase env not set at build')
    const supabase = createClient(url, anon, { auth: { persistSession: false } })

    const citiesPromise = supabase
      .from('cities')
      .select('name')
      .eq('is_active', true)

    // PostgREST caps un-ranged SELECTs at 1000 rows — a single
    // `.select('id')` silently truncated the sitemap once the restaurant
    // count crossed that line. Page through with .range() until a short
    // page signals the end.
    const PAGE_SIZE = 1000
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error || !data) break
      for (const { id } of data) {
        if (!id) continue
        dynamicEntries.push({
          url: `${SITE_URL}/restaurants/${id}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
      if (data.length < PAGE_SIZE) break
    }

    const citiesRes = await citiesPromise

    // The dedicated /cities pages were removed; city now lives only as a
    // case-insensitive `?city=` filter on /discover (the former /explore
    // is a permanent redirect there). Point per-city URLs at that filter.
    if (!citiesRes.error && citiesRes.data) {
      for (const { name } of citiesRes.data) {
        if (!name) continue
        dynamicEntries.push({
          url: `${SITE_URL}/discover?city=${encodeURIComponent(name)}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      }
    }
  } catch (err) {
    // Build-time prerender without env, or a transient DB failure: emit
    // the static set so the sitemap is never empty/500.
    console.error('[sitemap] dynamic route enumeration failed:', err)
  }

  return [...staticEntries, ...dynamicEntries]
}
