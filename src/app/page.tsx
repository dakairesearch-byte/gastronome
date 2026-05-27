import Link from 'next/link'
import { Search } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import SuggestionCard from '@/components/cards/SuggestionCard'
import RecentSearches from '@/components/home/RecentSearches'
import FavoritesSection from '@/components/home/FavoritesSection'
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
 */
const EDITORIAL_PICKS = [
  {
    id: 'date-night',
    name: 'Date Night',
    type: 'French · romance',
    image:
      'https://images.unsplash.com/photo-1722938687772-62a0dbfacc25?w=600&q=80',
    href: '/explore?cuisine=French',
  },
  {
    id: 'quick-lunch',
    name: 'Quick Lunch',
    type: 'Sandwiches · weekday',
    image:
      'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=600&q=80',
    href: '/explore?cuisine=Sandwich',
  },
  {
    id: 'special-occasions',
    name: 'Special Occasions',
    type: 'Michelin · celebration',
    image:
      'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=80',
    href: '/explore?accolade=michelin_star',
  },
  {
    id: 'hidden-gems',
    name: 'Hidden Gems',
    type: 'High rating · low review count',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    href: '/explore?accolade=hidden_gems',
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
  let suggestions: Restaurant[] = trendingRestaurants
  if (suggestions.length === 0) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .ilike('city', city)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(8)
    suggestions = (data ?? []) as Restaurant[]
  }

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
            Every rating — Google, Yelp, Michelin, Eater, James Beard, The
            Infatuation, TikTok — in one place. Decide in one tab instead of
            six.
          </p>
          <Link
            href="/search"
            className="group inline-flex items-center gap-3 max-w-2xl w-full px-4 py-3.5 rounded-xl border transition-all"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
            aria-label="Search restaurants, cuisines, or dishes"
          >
            <Search
              size={18}
              aria-hidden="true"
              style={{ color: 'var(--color-text-secondary)' }}
            />
            <span
              className="text-sm"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Search restaurants, cuisines, neighborhoods, or dishes…
            </span>
          </Link>
        </section>

        {/* Suggestions section — header names the city so users never
            have to wonder. Eyebrow label changed from "Curated Selection"
            (which overpromised editorial taste on what is actually a
            7-day trending algorithm) to "Trending this week". */}
        <section className="mb-16">
          <SectionHeader
            label="Trending this week"
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
                style={{ color: 'var(--color-accent)' }}
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

        {/* Personal rails — RecentSearches and FavoritesSection already
            know how to handle empty state internally (each component
            returns null when there's nothing to show), so we just let
            them self-suppress rather than rendering empty headers above
            empty sections. Sweep v2 P0: previously rendered "Your
            Favorites" + "Recent Searches" with empty cells, making the
            page look abandoned. */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <section>
            <SectionHeader title="Recent searches" />
            <RecentSearches />
          </section>

          <section>
            <SectionHeader title="Your favorites" />
            <FavoritesSection />
          </section>
        </div>

        {/* Editorial picks — was "Saved Collections" which implied user
            data. Renamed to make the curated-entry intent explicit. The
            bookmark hover icon was removed (these aren't user saves). */}
        <section>
          <SectionHeader
            label="Editor's gateways"
            title="Editorial Picks"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {EDITORIAL_PICKS.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className="overflow-hidden cursor-pointer transition-all hover:shadow-2xl group rounded-sm block"
                style={{ backgroundColor: 'var(--color-surface)' }}
                aria-label={`${c.name} — ${c.type}`}
              >
                <div className="overflow-hidden relative rounded-sm aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt=""
                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
                  />
                </div>
                <div className="p-4">
                  <h3
                    className="text-base mb-1"
                    style={{
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                    }}
                  >
                    {c.name}
                  </h3>
                  <p
                    className="text-xs uppercase"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {c.type}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
