import Link from 'next/link'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import Top10Trending from '@/components/explore/Top10Trending'
import ExploreCollectionCard from '@/components/cards/ExploreCollectionCard'
import EmptyState from '@/components/EmptyState'
import CategoryFilters from '@/components/explore/CategoryFilters'
import RestaurantCard from '@/components/RestaurantCard'
import { MapPin } from 'lucide-react'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

// NOTE: href values are read as query strings by this page below.
// Each collection maps to a real filter predicate that runs against
// `restaurants`, so tiles only render when the live count > 0 in the
// active city (see the `.filter((c) => c.count > 0)` below). Collections
// whose mapping can't be trusted to return anything meaningful are not
// listed here — previously we had Date Night→French, Street Food→Mexican,
// and Healthy→Salad, which felt dummy because the cuisine column doesn't
// carry those semantics.
const COLLECTIONS = [
  {
    // Consensus Picks: scored by topConsensusPicks() — restaurants where
    // Google, Yelp, TikTok, and Instagram all converge. Always capped at
    // 20 by the algorithm, so the count short-circuits to 20 below
    // rather than running a head:true query (no easy way to count the
    // social-platforms join in head mode).
    id: 'consensus-picks',
    title: 'Consensus Picks',
    description:
      'The rare places where Google, Yelp, TikTok, and Instagram all agree.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?accolade=consensus_picks',
  },
  {
    id: 'hidden-gems',
    title: 'Hidden Gems',
    description: 'Highly-rated spots that still fly under the radar.',
    image: 'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?accolade=hidden_gems',
  },
  {
    id: 'michelin-stars',
    title: 'Michelin Stars',
    description: 'Every starred table in this city, one tap away.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?accolade=michelin_star',
  },
  {
    id: 'bib-gourmand',
    title: 'Bib Gourmand',
    description: 'Michelin-recommended value cooking that punches above its price.',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?accolade=bib_gourmand',
  },
  {
    id: 'james-beard',
    title: 'James Beard Spotlight',
    description: 'Restaurants and chefs recognized by the James Beard Foundation.',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?accolade=james_beard',
  },
  {
    id: 'eater-38',
    title: 'Eater 38',
    description: "Eater's essential list of the city's must-try restaurants.",
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?accolade=eater_38',
  },
  {
    id: 'brunch',
    title: 'Best for Brunch',
    description: 'Weekend brunch destinations worth the wait.',
    image: 'https://images.unsplash.com/photo-1516061821-2ac22e822d3f?w=600&q=80',
    curator: 'Editorial',
    href: '/explore?cuisine=Brunch',
  },
]

const DEFAULT_CITY = 'New York'

interface SearchParamsInput {
  city?: string
  cuisine?: string
  accolade?: string
  /** Michelin Stars page only — accepts "1", "2", "3", anything else
   *  is treated as no filter. */
  stars?: string
  /** "az" sorts alphabetically; anything else (including absent) keeps
   *  the default top-rated sort. */
  sort?: string
}

// Friendly category labels used in headings and section titles. Kept
// in sync with `COLLECTIONS` titles so the UI doesn't drift.
const ACCOLADE_TITLES: Record<string, string> = {
  michelin_star: 'Michelin Stars',
  bib_gourmand: 'Bib Gourmand',
  james_beard: 'James Beard Spotlight',
  eater_38: 'Eater 38',
  hidden_gems: 'Hidden Gems',
  consensus_picks: 'Consensus Picks',
}

// NOTE: filter logic used to live here as `applyAccoladeFilter` /
// `applyCuisineFilter` that ran client-side over a `.limit(500)` page.
// Both predicates are now pushed into the Supabase query in the filtered
// branch of `ExplorePage` so we don't silently drop rows past the cap.

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>
}) {
  const raw = await searchParams
  const supabase = await createServerSupabaseClient()

  const { data: cityRows } = await supabase
    .from('cities')
    .select('name, slug')
    .eq('is_active', true)
    .order('restaurant_count', { ascending: false })
  const cities = (cityRows ?? []).map((c) => c.name)

  // Default city resolution:
  //   1. URL param (case-insensitive match against the cities table)
  //   2. URL param verbatim if it didn't match (custom city)
  //   3. Logged-in user's profile.home_city
  //   4. First city from DB / hard-coded default
  // Step 3 is the new piece — previously the page always defaulted to
  // whatever city had the most restaurants, even for users who had
  // explicitly set their home city during onboarding.
  const requestedCity = raw.city?.trim()
  const matchedCity =
    requestedCity &&
    cities.find((c) => c.toLowerCase() === requestedCity.toLowerCase())

  let homeCity: string | null = null
  if (!requestedCity) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_city')
        .eq('id', user.id)
        .single()
      const candidate = profile?.home_city?.trim() ?? null
      // Resolve to the canonical name in the cities table when possible
      // so headings render with consistent casing.
      if (candidate) {
        homeCity =
          cities.find((c) => c.toLowerCase() === candidate.toLowerCase()) ||
          candidate
      }
    }
  }

  const activeCity =
    matchedCity ||
    requestedCity ||
    homeCity ||
    cities[0] ||
    DEFAULT_CITY

  const activeCuisine = raw.cuisine?.trim() || null
  const activeAccolade = raw.accolade?.trim() || null
  const parsedStars = Number.parseInt(raw.stars ?? '', 10)
  const activeStars: 1 | 2 | 3 | null =
    parsedStars === 1 || parsedStars === 2 || parsedStars === 3
      ? parsedStars
      : null
  const activeSort: 'top' | 'az' = raw.sort === 'az' ? 'az' : 'top'
  const isFiltering = Boolean(activeCuisine || activeAccolade)

  // Unfiltered experience: Top 10 trending + editorial collection cards.
  if (!isFiltering) {
    const trending = await topTrendingRestaurants(supabase, {
      city: activeCity,
      window: '30d',
      limit: 10,
    })

    // Keep trending rows typed so the Top10Trending component sees
    // trending_counts on the algorithm-ranked rows. The rating-DESC
    // fallback rows DON'T have counts attached, and the component
    // labels them "Also highly rated" instead of mixing them silently
    // into the trending-branded list (sweep v2 alarming finding).
    type RankedRestaurant = Restaurant & {
      trending_counts?: { videos: number; reviews: number; photos: number }
      trending_score?: number
    }
    const top10: RankedRestaurant[] = [...trending]
    if (top10.length < 10) {
      const existing = new Set(top10.map((r) => r.id))
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .ilike('city', activeCity)
        .order('google_rating', { ascending: false, nullsFirst: false })
        .limit(10)
      for (const row of (data ?? []) as Restaurant[]) {
        if (top10.length >= 10) break
        if (!existing.has(row.id)) top10.push(row)
      }
    }

    // Real counts: each tile previously advertised a hardcoded
    // `8 + ((i*7)%14)` placeholder. Now we run the same filter the tile
    // links to and count the actual matching rows in the active city.
    // Kept parallel; each query is a `head: true` count so we don't
    // pay the page-size transfer cost.
    const collectionCounts = await Promise.all(
      COLLECTIONS.map(async (c) => {
        const url = new URL(c.href, 'https://placeholder.invalid')
        const accolade = url.searchParams.get('accolade')
        const cuisine = url.searchParams.get('cuisine')
        // Consensus Picks is algorithm-backed, not a column predicate —
        // the ranker always caps at 20, so short-circuit here rather
        // than spinning up the social-platforms join just to count.
        if (accolade === 'consensus_picks') {
          return { ...c, count: 20 }
        }
        let q = supabase
          .from('restaurants')
          .select('id', { count: 'exact', head: true })
          .ilike('city', activeCity)
        if (cuisine) q = q.ilike('cuisine', cuisine)
        if (accolade === 'michelin_star') q = q.gt('michelin_stars', 0)
        if (accolade === 'bib_gourmand')
          q = q.eq('michelin_designation', 'bib_gourmand')
        if (accolade === 'james_beard')
          // `james_beard_nominated` was dropped — winners only.
          q = q.eq('james_beard_winner', true)
        if (accolade === 'eater_38') q = q.eq('eater_38', true)
        if (accolade === 'hidden_gems')
          q = q.gte('google_rating', 4.3).lte('google_review_count', 500)
        const { count } = await q
        return { ...c, count: count ?? 0 }
      })
    )

    // Star-count breakdown for the Michelin Stars tile so the user can
    // see at a glance how the city's starred entries split across 1/2/3
    // stars before clicking in. Returns null when the tile is absent or
    // there are no starred entries in the active city.
    let michelinBreakdown: { one: number; two: number; three: number } | null = null
    const michelinTile = collectionCounts.find((c) => c.id === 'michelin-stars')
    if (michelinTile && michelinTile.count > 0) {
      const buckets = await Promise.all(
        [1, 2, 3].map(async (n) => {
          const { count } = await supabase
            .from('restaurants')
            .select('id', { count: 'exact', head: true })
            .ilike('city', activeCity)
            .eq('michelin_stars', n)
          return count ?? 0
        })
      )
      michelinBreakdown = {
        one: buckets[0],
        two: buckets[1],
        three: buckets[2],
      }
    }

    return (
      <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
        <ExploreSearchBar cities={cities} initialCity={activeCity} />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          {top10.length > 0 && (
            <Top10Trending city={activeCity} restaurants={top10} />
          )}

          {(() => {
            // Hide collections that have zero matches in the active city.
            // Previously every tile rendered regardless of count, so
            // clicking into a collection could land on an empty results
            // page — and tiles advertised "0 places", which felt like
            // broken dummy content.
            const liveCollections = collectionCounts.filter((c) => c.count > 0)
            if (liveCollections.length === 0) return null
            return (
              <section>
                <SectionHeader label="Expertly Curated" title="Categories" />
                {/* 4-up on lg (was 3-up). With 7 categories and the
                    description paragraph dropped on the tile itself, 4
                    columns fit above the fold on a 1440 viewport. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {liveCollections.map((c) => (
                    <ExploreCollectionCard
                      key={c.id}
                      {...c}
                      breakdown={
                        c.id === 'michelin-stars' && michelinBreakdown
                          ? michelinBreakdown
                          : null
                      }
                    />
                  ))}
                </div>
              </section>
            )
          })()}
        </div>
      </div>
    )
  }

  // Consensus Picks early-return — algorithm-backed, doesn't fit the
  // generic column-predicate query path. The scorer combines Google
  // rating, Yelp rating, TikTok engagement, and Instagram engagement
  // into a weighted composite and caps at 20. We render through the
  // same filtered-results JSX as the other accolades by populating
  // `filtered` and skipping the generic Supabase query.
  let filtered: Restaurant[] = []
  let filteredTotal: number | null = null

  if (activeAccolade === 'consensus_picks') {
    const { topConsensusPicks } = await import(
      '@/lib/ranking/consensusPicks'
    )
    filtered = await topConsensusPicks(supabase, {
      city: activeCity,
      limit: 20,
    })
    filteredTotal = filtered.length
  }

  // Filtered experience: push cuisine / accolade predicates INTO the DB
  // query so we don't silently drop rows past a hardcoded client-side cap
  // (QA pass 2: advertised "15 Hidden Gems" was actually 193; cap was 500
  // and the footer read "filtered from 500" even if the city had 2000).
  // Skipped entirely for consensus_picks — that path was already handled
  // above by the algorithmic ranker.
  if (activeAccolade !== 'consensus_picks') {
    let query = supabase
      .from('restaurants')
      .select('*', { count: 'exact' })
      .ilike('city', activeCity)
      .limit(500)

    // Sort: top-rated by default, A–Z when explicitly requested.
    if (activeSort === 'az') {
      query = query.order('name', { ascending: true })
    } else {
      query = query.order('google_rating', {
        ascending: false,
        nullsFirst: false,
      })
    }

    if (activeCuisine) query = query.ilike('cuisine', activeCuisine)
    if (activeAccolade === 'michelin_star') {
      // When the user picks a specific star count, narrow to that
      // bucket; otherwise show all starred (1/2/3) entries.
      if (activeStars != null) {
        query = query.eq('michelin_stars', activeStars)
      } else {
        query = query.gt('michelin_stars', 0)
      }
    }
    if (activeAccolade === 'bib_gourmand')
      query = query.eq('michelin_designation', 'bib_gourmand')
    if (activeAccolade === 'james_beard')
      // james_beard_nominated column was dropped; winners only.
      query = query.eq('james_beard_winner', true)
    if (activeAccolade === 'eater_38') query = query.eq('eater_38', true)
    if (activeAccolade === 'hidden_gems')
      query = query.gte('google_rating', 4.3).lte('google_review_count', 500)

    const { data: rows, count } = await query
    filtered = (rows ?? []) as Restaurant[]
    filteredTotal = count ?? null
  }

  // Cuisine list for the filter dropdown — distinct cuisines that
  // appear in the active city × accolade combination, IGNORING the
  // current cuisine filter. Building this from `filtered` was wrong:
  // once the user picked "French", `filtered` only contained French
  // rows, so the dropdown collapsed to just "French" and the user
  // couldn't switch to another cuisine without clearing filters
  // first. The fix runs a separate light query that applies the same
  // city + accolade predicates but skips the cuisine predicate.
  // Skips "Restaurant" / "Fine Dining" because they're catch-all
  // venue types, not cuisines.
  let cuisines: string[] = []
  if (activeAccolade && activeAccolade !== 'consensus_picks') {
    let cuisineQuery = supabase
      .from('restaurants')
      .select('cuisine')
      .ilike('city', activeCity)
      .not('cuisine', 'is', null)
      .limit(2000)
    if (activeAccolade === 'michelin_star') {
      // Star count filter is applied here too — picking ★★★ should
      // restrict the cuisines list to cuisines that have at least one
      // 3-star match in the city, otherwise the dropdown would offer
      // options that lead to an empty page.
      if (activeStars != null) {
        cuisineQuery = cuisineQuery.eq('michelin_stars', activeStars)
      } else {
        cuisineQuery = cuisineQuery.gt('michelin_stars', 0)
      }
    }
    if (activeAccolade === 'bib_gourmand')
      cuisineQuery = cuisineQuery.eq('michelin_designation', 'bib_gourmand')
    if (activeAccolade === 'james_beard')
      cuisineQuery = cuisineQuery.eq('james_beard_winner', true)
    if (activeAccolade === 'eater_38')
      cuisineQuery = cuisineQuery.eq('eater_38', true)
    if (activeAccolade === 'hidden_gems')
      cuisineQuery = cuisineQuery
        .gte('google_rating', 4.3)
        .lte('google_review_count', 500)
    const { data: cuisineRows } = await cuisineQuery
    cuisines = Array.from(
      new Set(
        (cuisineRows ?? [])
          .map((r) => r.cuisine as string | null)
          .filter(
            (c): c is string =>
              !!c && c !== 'Restaurant' && c !== 'Fine Dining'
          )
      )
    ).sort()
  }

  // Count of restaurants in the city (ignoring the filter) — used for
  // the "… of N total" footer.
  const { count: cityTotal } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .ilike('city', activeCity)

  // Friendly label for the collection that was clicked.
  const matching = COLLECTIONS.find(
    (c) =>
      c.href === `/explore?cuisine=${activeCuisine}` ||
      c.href === `/explore?accolade=${activeAccolade}`
  )
  const heading =
    matching?.title ||
    (activeAccolade ? ACCOLADE_TITLES[activeAccolade] : null) ||
    [activeCuisine, activeAccolade?.replace(/_/g, ' ')].filter(Boolean).join(' · ')

  // Group results by Michelin star count when we're on the Michelin
  // page with no specific star filter. This replaces the wall of 100+
  // identical-looking cards with three clearly-labeled bands so the
  // user can scan the most prestigious tier first. When the user picks
  // a specific star count the grouping collapses to a single section.
  const showMichelinGrouping =
    activeAccolade === 'michelin_star' && activeStars == null
  const michelinGroups = showMichelinGrouping
    ? ([3, 2, 1] as const).map((n) => ({
        stars: n,
        items: filtered.filter((r) => r.michelin_stars === n),
      }))
    : []

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <ExploreSearchBar cities={cities} initialCity={activeCity} />

      {/* Suspense boundary: CategoryFilters uses next/navigation's
          useSearchParams() which Next.js requires be wrapped in
          Suspense, otherwise the page deopts to fully dynamic
          rendering AND can throw React #418 hydration warnings on
          first paint. The fallback is just the rail's chrome so
          there's no layout shift while client-side params resolve. */}
      <Suspense
        fallback={
          <div
            className="sticky top-16 md:top-20 z-30 border-b backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderColor: 'var(--color-border)',
              height: 56,
            }}
            aria-hidden
          />
        }
      >
        <CategoryFilters
          cities={cities}
          cuisines={cuisines}
          currentCity={activeCity}
          currentAccolade={activeAccolade}
          currentStars={activeStars}
          currentCuisine={activeCuisine}
          currentSort={activeSort}
        />
      </Suspense>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="mb-6 flex items-center justify-between">
          <SectionHeader label={activeCity.toUpperCase()} title={heading || 'Filtered'} />
          <Link
            href="/explore"
            className="text-sm underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Clear filters
          </Link>
        </div>

        <p className="text-xs mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {filteredTotal ?? filtered.length} matching · {cityTotal ?? '—'} {activeCity} restaurants total
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No matches"
            description="Try a different filter or clear them all to see every restaurant in this city."
          />
        ) : showMichelinGrouping ? (
          <div className="space-y-12">
            {michelinGroups.map((g) => {
              if (g.items.length === 0) return null
              return (
                <section key={g.stars}>
                  <div className="flex items-baseline gap-3 mb-4">
                    <h2
                      className="text-2xl font-bold"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {'★'.repeat(g.stars)}{' '}
                      {g.stars === 1 ? 'One Star' : g.stars === 2 ? 'Two Stars' : 'Three Stars'}
                    </h2>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {g.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {g.items.map((r) => (
                      <RestaurantCard key={r.id} restaurant={r} variant="hero" />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} variant="hero" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
