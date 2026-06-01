import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import SuggestionCard from '@/components/cards/SuggestionCard'
import RecentSearches from '@/components/home/RecentSearches'
import FavoritesSection from '@/components/home/FavoritesSection'
import EditorialPickImage from '@/components/home/EditorialPickImage'
import SearchAutocomplete from '@/components/search/SearchAutocomplete'
import { EDITORIAL_COLLECTIONS } from '@/lib/collections/editorial'
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

/**
 * Editorial picks — formerly labeled "Saved Collections," which made
 * every user expect to manage their own saves under that header. These
 * are curated entry points into filtered Explore views (no user data
 * involved). Renamed + rephrased to set honest expectations. The
 * hover-bookmark affordance was also removed downstream — they're not
 * saveable, so the bookmark icon was a false signal.
 *
 * D1 (Wave 5) — taxonomy reconciliation + honest copy:
 *  - The Michelin pick used to be named "Special Occasions" here but
 *    "Michelin Stars" on Explore — two names for one collection. It now
 *    pulls its name + blurb from the canonical EDITORIAL_COLLECTIONS
 *    (matched by accolade filter value) so home and Explore can never
 *    drift. Same for Eater 38.
 *  - `tagline` replaced the old `type`, which leaked internal predicate
 *    codes ("High rating · low review count") into the UI. Each pick now
 *    states the user benefit instead.
 *  - Date Night / Quick Lunch / Hidden Gems are home-only shortcuts (not
 *    canonical collections), so they carry local benefit copy.
 */

/** Canonical collection blurb keyed by its accolade filter value, so a
 *  home pick that maps to a real Explore collection borrows the exact
 *  same title + description. Falls back to the pick's local copy. */
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
    // Data uses the plural cuisine value "Sandwiches"; the old singular
    // "Sandwich" matched 0 rows and the tile dead-ended on an empty page.
    href: '/discover?cuisine=Sandwiches',
  },
  {
    // Renamed Special Occasions -> Michelin Stars so the collection has
    // ONE name across home + Explore. Name/blurb sourced from canonical.
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
 * Resolve the city to show on the home page Suggestions section.
 *
 * Signed-in users get their `profiles.home_city` so a Miami user sees
 * Miami restaurants on the home page. Anonymous users fall back to the
 * NYC default. Both paths surface the active city in the section label
 * so the user always knows which city the suggestions are for.
 */
async function resolveHomeCity(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<{ city: string; source: 'profile' | 'fallback' }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { city: FALLBACK_CITY, source: 'fallback' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('home_city')
    .eq('id', user.id)
    .maybeSingle()
  const homeCity = profile?.home_city
  return homeCity
    ? { city: homeCity, source: 'profile' }
    : { city: FALLBACK_CITY, source: 'fallback' }
}

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const { city, source: citySource } = await resolveHomeCity(supabase)

  const trendingRestaurants = await topTrendingRestaurants(supabase, {
    city,
    window: '7d',
    limit: 8,
  })

  // Fallback: if trending has no results, show top-rated in the same city.
  // [sweep-2026-05-26-v3 microcopy QW] Track whether we fell back so the
  // section eyebrow can be honest ("Top-rated in X" vs "Trending this week").
  let suggestions: Restaurant[] = trendingRestaurants
  let usedTrendingFallback = false
  if (suggestions.length === 0) {
    usedTrendingFallback = true
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .ilike('city', city)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(8)
    suggestions = (data ?? []) as Restaurant[]
  }

  // Count-gate the Editorial Picks the same way Explore does so a curated
  // tile never dead-ends on an empty results page. Each pick links to a
  // real filter predicate (cuisine or accolade); we run a head:true count
  // in the active city and drop tiles with zero matches. We also append
  // the resolved &city= to every href so a Miami user lands on Miami
  // results instead of the page's default city.
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

        // Append the resolved city so the destination matches what the
        // home page is showing.
        url.searchParams.set('city', city)
        const href = `/discover${url.search}`

        return { ...pick, href, count: count ?? 0 }
      }),
    )
  ).filter((pick) => pick.count > 0)

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Search hero — primary "where do I go tonight" entry point.
            Sweep v2 P0: home page previously had no search affordance
            anywhere; a diner with intent ("Italian, tonight") couldn't
            ask the homepage anything. Now the page leads with one. */}
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
          {/* Real autocomplete (hero variant) — the static <Link> here
              looked like a search box but typing did nothing and no query
              was ever recorded. SearchAutocomplete fires live suggestions,
              records the search into RecentSearches, and scopes results to
              the resolved city. */}
          <div className="max-w-2xl">
            <SearchAutocomplete
              variant="hero"
              city={city}
              placeholder="Search restaurants, cuisines, neighborhoods, or dishes…"
            />
          </div>
          {/* Scent chips — advertise that dish + neighborhood search exist.
              The hero box accepts free text, but nothing told users they
              could search by a specific dish or a neighborhood. "By dish"
              flips /discover into dishes mode; the example chips prefill a
              query that resolves against dish names and neighborhoods. All
              route into the unified /discover surface (mode + q params it
              reads). */}
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
        </section>

        {/* Suggestions section — header names the city so users never
            have to wonder. Eyebrow label changed from "Curated Selection"
            (which overpromised editorial taste on what is actually a
            7-day trending algorithm) to "Trending this week".
            [sweep-2026-05-26-v3 microcopy QW] When trending was empty and
            we fell back to top-rated, use "Top-rated in {city}" so the
            label is honest about what the user is actually seeing. */}
        <section className="mb-16">
          <SectionHeader
            label={usedTrendingFallback ? `Top-rated in ${city}` : 'Trending this week'}
            title={`Suggestions in ${city}`}
          />
          {citySource === 'fallback' && (
            <p
              className="text-xs mb-4 -mt-2"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {suggestions.map((r) => (
              <SuggestionCard key={r.id} restaurant={r} />
            ))}
          </div>
        </section>

        {/* Personal rails — RecentSearches and FavoritesSection each own
            their <SectionHeader> now (sweep-2026-05-26-v3 R2). Both
            components return null when empty, so no orphan heading floats
            over blank space. The <section> wrappers are kept for layout
            but hold no heading of their own. */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <section>
            <RecentSearches />
          </section>

          <section>
            <FavoritesSection />
          </section>
        </div>

        {/* Editorial picks — was "Saved Collections" which implied user
            data. Renamed to make the curated-entry intent explicit. The
            bookmark hover icon was removed (these aren't user saves).
            D1 (Wave 5): eyebrow is now "Editor's picks" — these are NOT
            personalized, so the old "Curated for you" overpromised. Each
            tile surfaces the live count computed above and a plain-English
            benefit tagline (not the internal predicate code), and the rail
            carries a "See all collections" link into the Explore taxonomy
            so home + Explore read as one system. */}
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
          {/* Bridge into the full Discover taxonomy so the home rail does
              not read as a separate, competing set of collections. */}
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
