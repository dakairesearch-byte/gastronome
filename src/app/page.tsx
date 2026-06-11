import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SearchAutocomplete from '@/components/search/SearchAutocomplete'
import { EDITORIAL_COLLECTIONS } from '@/lib/collections/editorial'
import { gastronomeScore } from '@/lib/score'
import {
  seededDailyShuffle,
  mmrDiversify,
  imputeQuality,
  buildCohortMedians,
} from '@/lib/ranking/explore'
import TrendingRail from '@/components/home/TrendingRail'
import CityBestRail from '@/components/home/CityBestRail'
import ForYourTastesRail from '@/components/home/ForYourTastesRail'
import WorthALookRail from '@/components/home/WorthALookRail'
import RecentSearches from '@/components/home/RecentSearches'
import FavoritesSection from '@/components/home/FavoritesSection'
import EditorialPickImage from '@/components/home/EditorialPickImage'
import SectionHeader from '@/components/SectionHeader'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

/**
 * Default city when no user profile is available. Used for anonymous
 * visitors only — signed-in users get their `profiles.home_city`. The
 * previous hardcoded "New York" was the single most-cited issue in the
 * v2 sweep (6 specialists, P0): non-NYC users silently saw NYC
 * restaurants with no city label.
 */
const FALLBACK_CITY = 'New York'

/** Canonical collection blurb keyed by its accolade filter value */
function canonicalByAccolade(value: string) {
  return EDITORIAL_COLLECTIONS.find(
    (c) => c.filter.kind === 'accolade' && c.filter.value === value,
  )
}

const michelin = canonicalByAccolade('michelin_star')
const eater = canonicalByAccolade('eater_38')

const EDITORIAL_PICKS = [
  {
    id: 'date-night',
    name: 'Date Night',
    tagline: 'Low-lit French rooms that do the work for you',
    image:
      'https://images.unsplash.com/photo-1722938687772-62a0dbfacc25?w=600&q=80',
    href: '/discover?cuisine=French',
  },
  {
    id: 'quick-lunch',
    name: 'Quick Lunch',
    tagline: 'Great sandwiches, in and out, back to work',
    image:
      'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=600&q=80',
    href: '/discover?cuisine=Sandwiches',
  },
  {
    id: 'michelin-stars',
    name: michelin?.title ?? 'Michelin Stars',
    tagline:
      michelin?.description ?? 'Every starred table in this city, one tap away.',
    image:
      'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=80',
    href: '/discover?accolade=michelin_star',
  },
  {
    id: 'hidden-gems',
    name: 'Hidden Gems',
    tagline: 'Neighborhood favorites the crowds have not found',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    href: '/discover?accolade=hidden_gems',
  },
  {
    id: 'eater-38',
    name: eater?.title ?? 'Eater 38',
    tagline:
      eater?.description ?? "Eater's essential list of must-try restaurants.",
    image:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
    href: '/discover?accolade=eater_38',
  },
]

/**
 * Resolve the city to show on the home page.
 *
 * Signed-in users get their `profiles.home_city` so a Miami user sees
 * Miami restaurants on the home page. Anonymous users fall back to the
 * NYC default. Both paths surface the active city in the section label
 * so the user always knows which city the suggestions are for.
 */
async function resolveHomeCity(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<{
  city: string
  source: 'profile' | 'fallback'
  userId: string | null
  favoriteCuisines: string[]
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { city: FALLBACK_CITY, source: 'fallback', userId: null, favoriteCuisines: [] }
  const { data: profile } = await supabase
    .from('profiles')
    .select('home_city, favorite_cuisines')
    .eq('id', user.id)
    .maybeSingle()
  const homeCity = profile?.home_city
  const rawCuisines = profile?.favorite_cuisines
  const favoriteCuisines = Array.isArray(rawCuisines)
    ? rawCuisines.filter((c): c is string => typeof c === 'string')
    : []
  return homeCity
    ? { city: homeCity, source: 'profile', userId: user.id, favoriteCuisines }
    : { city: FALLBACK_CITY, source: 'fallback', userId: user.id, favoriteCuisines }
}

/**
 * Dedupe restaurants top-down: a restaurant that already appears in
 * an earlier rail is removed from later rails.
 */
function dedupeAgainst(candidates: Restaurant[], seen: Set<string>): Restaurant[] {
  const out: Restaurant[] = []
  for (const r of candidates) {
    if (!seen.has(r.id)) {
      out.push(r)
      seen.add(r.id)
    }
  }
  return out
}

/** Today's date string in YYYY-MM-DD format (UTC), stable intra-day. */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Number of restaurant columns on this rail. */
const RAIL_SIZE = 8

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const { city, source: citySource, userId, favoriteCuisines } =
    await resolveHomeCity(supabase)

  // ── Rail 1: Trending ──────────────────────────────────────────────────────
  // Existing topTrendingRestaurants — untouched lib. No MMR on this rail.
  const trendingRestaurants = await topTrendingRestaurants(supabase, {
    city,
    window: '7d',
    limit: RAIL_SIZE,
  })

  // ── Fetch the full city pool once — shared across rails 2-4 ──────────────
  // Fetch enough candidates that each rail has room after deduplication.
  const { data: cityPool } = await supabase
    .from('restaurants')
    .select('*')
    .ilike('city', city)
    .limit(300)
  const allCityRestaurants = (cityPool ?? []) as Restaurant[]

  // Pre-compute Gastronome Scores for the whole pool once.
  const scoreMap: Record<string, number> = {}
  for (const r of allCityRestaurants) {
    const gs = gastronomeScore(r)
    if (gs !== null) scoreMap[r.id] = gs.score
  }

  // Dedupe set — tracks what has already been shown in an earlier rail.
  const seen = new Set<string>(trendingRestaurants.map((r) => r.id))

  // ── Rail 2: Best of {city} ────────────────────────────────────────────────
  // gastronomeScore with 2+ sources, sorted by score, then MMR diversify.
  const multiSourceCandidates = allCityRestaurants.filter((r) => {
    const gs = gastronomeScore(r)
    return gs !== null && gs.sourceCount >= 2
  })
  const cityBestSorted = [...multiSourceCandidates].sort(
    (a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0),
  )
  const cityBestPool = dedupeAgainst(cityBestSorted.slice(0, 32), seen)
  const cityBestRaw = mmrDiversify(
    cityBestPool,
    (r) => scoreMap[r.id] ?? 0,
  )
  const cityBestRestaurants = cityBestRaw.slice(0, RAIL_SIZE)
  for (const r of cityBestRestaurants) seen.add(r.id)

  // ── Rail 3: For your tastes ───────────────────────────────────────────────
  // Candidate pool = city restaurants with a score. Server passes the pool
  // and the score map; ForYourTastesRail re-ranks client-side using
  // getTasteAffinity (localStorage). Taste affinities are 1.0 on server.
  //
  // Day-0 fallback (70/20/10 interleave) built server-side:
  //   70% multi-source best
  //   20% favorite_cuisines match
  //   10% explore pool (scoreless with imputation)
  const scoredCandidates = dedupeAgainst(
    [...allCityRestaurants].filter((r) => scoreMap[r.id] !== undefined),
    new Set(seen), // snapshot; don't mutate seen yet
  )

  // Build 70/20/10 fallback for cold-start users.
  // Rounding note: at RAIL_SIZE=8 naive rounding (6/2/0) starves the 10%
  // explore slot entirely. Guarantee the explore slot at least 1 card and
  // give the cuisine slot the remainder so the day-0 mix stays honest.
  const fallback70Count = Math.round(RAIL_SIZE * 0.7)
  const fallback10Count = Math.max(1, Math.floor(RAIL_SIZE * 0.1))
  const fallback20Count = Math.max(0, RAIL_SIZE - fallback70Count - fallback10Count)

  const bestForFallback = cityBestSorted
    .filter((r) => !seen.has(r.id))
    .slice(0, fallback70Count * 4)
  const fallback70 = mmrDiversify(bestForFallback, (r) => scoreMap[r.id] ?? 0)
    .slice(0, fallback70Count)

  const cuisineMatch = favoriteCuisines.length > 0
    ? allCityRestaurants.filter(
        (r) =>
          r.cuisine &&
          favoriteCuisines.some(
            (c) => c.toLowerCase() === r.cuisine!.toLowerCase(),
          ) &&
          !seen.has(r.id) &&
          !fallback70.find((f) => f.id === r.id),
      )
    : []
  const fallback20 = [...cuisineMatch]
    .sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
    .slice(0, fallback20Count)

  // 10% explore picks (scored, deduped, seeded)
  const exploreSeed = `${userId ?? 'anon'}|${todayDateString()}`
  const remainingForExplore = allCityRestaurants.filter(
    (r) =>
      scoreMap[r.id] !== undefined &&
      !seen.has(r.id) &&
      !fallback70.find((f) => f.id === r.id) &&
      !fallback20.find((f) => f.id === r.id),
  )
  const fallback10 = seededDailyShuffle(
    remainingForExplore,
    (r) => scoreMap[r.id] ?? 0,
    exploreSeed,
  ).slice(0, fallback10Count)

  const day0Fallback: Restaurant[] = [...fallback70, ...fallback20, ...fallback10]
  // Backfill: anonymous users have no favorite_cuisines, so the 20% slot can
  // come up empty and leave the rail short. Top up from the remaining
  // city-best pool (already score-sorted, never previously shown).
  if (day0Fallback.length < RAIL_SIZE) {
    const have = new Set(day0Fallback.map((r) => r.id))
    for (const r of cityBestSorted) {
      if (day0Fallback.length >= RAIL_SIZE) break
      if (!seen.has(r.id) && !have.has(r.id)) {
        day0Fallback.push(r)
        have.add(r.id)
      }
    }
  }
  const tasteRailCandidates = dedupeAgainst(scoredCandidates, new Set(seen))

  // Mark these as seen after ForYourTastesRail renders (optimistic).
  // We pass candidates and let the client component pick up to 8 after MMR.
  // Update seen with the top candidates to reduce rail 4 overlap.
  for (const r of tasteRailCandidates.slice(0, RAIL_SIZE)) seen.add(r.id)

  // ── Rail 4: Worth a look ──────────────────────────────────────────────────
  // Scoreless/thin rows ranked by imputeQuality (ordering only, never displayed),
  // then seededDailyShuffle with daily rotation seed.
  //
  // Evidence gate: photo + address required (per plan §3).
  const scorelessCandidates = allCityRestaurants.filter(
    (r) =>
      scoreMap[r.id] === undefined &&
      !seen.has(r.id) &&
      // Evidence gate: must have a photo and an address.
      (r.photo_url || r.photo_urls?.[0] || r.google_photo_url) &&
      r.address,
  )

  // Build cohort medians from scored rows for imputation.
  const scoredRows = allCityRestaurants
    .filter((r) => scoreMap[r.id] !== undefined)
    .map((r) => ({ city: r.city, cuisine: r.cuisine, score: scoreMap[r.id] ?? null }))
  const { cohortMedians, cityMedians } = buildCohortMedians(scoredRows)

  // Rank by imputed quality (ordering only), then seeded daily shuffle.
  const scorelessWithImputed = scorelessCandidates.map((r) => ({
    restaurant: r,
    imputed: imputeQuality(
      { city: r.city, cuisine: r.cuisine },
      cohortMedians,
      cityMedians,
    ) ?? -999,
  }))
  scorelessWithImputed.sort((a, b) => b.imputed - a.imputed)

  // seededDailyShuffle with τ=0.25 on top imputed candidates.
  const worthALookSeed = `${userId ?? 'anon'}|${todayDateString()}`
  const shuffledScoreless = seededDailyShuffle(
    scorelessWithImputed.slice(0, 40).map((x) => x.restaurant),
    (r) => {
      const entry = scorelessWithImputed.find((e) => e.restaurant.id === r.id)
      // Shift imputed up so all values are positive before seededDailyShuffle
      // (it takes log of the score; negative/zero inputs get clamped to 1e-9).
      return Math.max(1e-9, (entry?.imputed ?? 0) + 10)
    },
    worthALookSeed,
  )

  // MMR diversify the explore rail.
  const worthALookRaw = mmrDiversify(
    shuffledScoreless.slice(0, 32),
    // Relevance for MMR: use imputed rank (index as proxy to preserve shuffle order).
    (r) => 1 / (1 + shuffledScoreless.indexOf(r)),
  )
  const worthALookRestaurants = worthALookRaw.slice(0, RAIL_SIZE)

  // ── Editorial picks (count-gated) ────────────────────────────────────────
  const editorialPicks = (
    await Promise.all(
      EDITORIAL_PICKS.map(async (pick) => {
        const url = new URL(pick.href, 'https://placeholder.invalid')
        const cuisine = url.searchParams.get('cuisine')
        const accolade = url.searchParams.get('accolade')

        let q = supabase
          .from('restaurants')
          .select('id', { count: 'exact', head: true })
          .ilike('city', city)
        if (cuisine) q = q.ilike('cuisine', cuisine)
        if (accolade === 'michelin_star') q = q.gt('michelin_stars', 0)
        if (accolade === 'eater_38') q = q.eq('eater_38', true)
        if (accolade === 'hidden_gems')
          q = q.gte('google_rating', 4.3).lte('google_review_count', 500)
        const { count } = await q

        url.searchParams.set('city', city)
        const href = `/discover${url.search}`

        return { ...pick, href, count: count ?? 0 }
      }),
    )
  ).filter((pick) => pick.count > 0)

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* ── Hero / Search ── preserved exactly as before; do not modify ── */}
        <section className="mb-12 sm:mb-16">
          <h1
            className="text-3xl sm:text-4xl mb-3"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
            }}
          >
            Where to eat in {city}.
          </h1>
          <p
            className="text-sm sm:text-base mb-5"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              maxWidth: '36rem',
            }}
          >
            The critics, the crowd, and the feed — every verdict on one page.
            Stop opening six tabs to pick dinner.
          </p>
          <div className="max-w-2xl">
            <SearchAutocomplete
              variant="hero"
              city={city}
              placeholder="Search restaurants, cuisines, neighborhoods, or dishes…"
            />
          </div>
          <div className="max-w-2xl mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/discover?mode=dishes"
              className="inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-on-action)',
                backgroundColor: 'var(--color-action)',
              }}
            >
              Search by dish
            </Link>
            {[
              { label: 'Omakase', q: 'Omakase' },
              { label: 'Birria tacos', q: 'Birria tacos' },
              { label: 'West Village', q: 'West Village' },
            ].map((chip) => (
              <Link
                key={chip.label}
                href={`/discover?q=${encodeURIComponent(chip.q)}`}
                className="inline-flex items-center text-xs px-3 py-1.5 rounded-full transition-colors hover:shadow-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {chip.label}
              </Link>
            ))}
          </div>
          {/* City resolution notice for anonymous users */}
          {citySource === 'fallback' && (
            <p
              className="text-xs mt-4"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Showing {city} by default —{' '}
              <Link
                href="/profile"
                style={{ color: 'var(--color-action)' }}
                className="underline-offset-2 hover:underline"
              >
                set your home city
              </Link>{' '}
              to personalize.
            </p>
          )}
        </section>

        {/* ── Four transparent rails ── */}

        {/* Rail 1 — Trending this week
            Objective: "What people are talking about right now"
            No MMR — trending is its own diversity signal.  */}
        <TrendingRail restaurants={trendingRestaurants} city={city} />

        {/* Rail 2 — Best of {city}
            Objective: "Highest-rated by cross-source consensus"
            Only restaurants with 2+ rating sources; MMR diversify applied. */}
        <CityBestRail restaurants={cityBestRestaurants} city={city} />

        {/* Rail 3 — For your tastes
            Objective: personalized ("Picked for your taste…") or honest cold-start
            ("Highly rated in your city, curated for a first visit").
            Client island: re-ranks by score × getTasteAffinity in browser.
            Day-0 fallback = 70/20/10 interleave built server-side.
            MMR diversify inside the component. */}
        <ForYourTastesRail
          candidates={tasteRailCandidates}
          fallbackRestaurants={day0Fallback}
          city={city}
          scores={scoreMap}
        />

        {/* Rail 4 — Worth a look
            Objective: "New and under-the-radar spots"
            Scoreless/thin rows; ranked by imputeQuality (ordering only, never shown);
            seededDailyShuffle rotates daily, stable intra-day.
            Cards always show honest no-score treatment.
            MMR diversify applied. */}
        <WorthALookRail restaurants={worthALookRestaurants} city={city} />

        {/* Personal rails — RecentSearches and FavoritesSection each own their
            <SectionHeader>; return null when empty so no orphan heading floats. */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <section>
            <RecentSearches />
          </section>
          <section>
            <FavoritesSection />
          </section>
        </div>

        {/* Editorial picks — count-gated, links into Explore */}
        {editorialPicks.length > 0 && (
          <section>
            <SectionHeader
              label="Editor's picks"
              title="Start here"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {editorialPicks.map((c) => (
                <Link
                  key={c.id}
                  href={c.href}
                  className="overflow-hidden cursor-pointer transition-shadow group block"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--r-card)',
                    boxShadow: 'var(--shadow-1)',
                  }}
                  aria-label={`${c.name} — ${c.tagline} (${c.count} in ${city})`}
                >
                  <div className="overflow-hidden relative rounded-sm aspect-square">
                    <EditorialPickImage src={c.image} />
                  </div>
                  <div className="p-4">
                    <h3
                      className="text-lg mb-1"
                      style={{
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 600,
                      }}
                    >
                      {c.name}
                    </h3>
                    <p
                      className="text-sm mb-2"
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {c.tagline}
                    </p>
                    <p
                      className="text-xs uppercase tracking-wide"
                      style={{
                        color: 'var(--color-action)',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                      }}
                    >
                      {c.count} {c.count === 1 ? 'spot' : 'spots'} in {city}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-6">
              <Link
                href="/discover"
                className="inline-flex items-center gap-1 text-sm hover:underline underline-offset-2"
                style={{
                  color: 'var(--color-action)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                See all collections
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
