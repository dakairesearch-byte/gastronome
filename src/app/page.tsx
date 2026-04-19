import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import SuggestionCard from '@/components/cards/SuggestionCard'
import RecentSearches from '@/components/home/RecentSearches'
import FavoritesSection from '@/components/home/FavoritesSection'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

/** Default city used for trending on the home page (matches /explore). */
const DEFAULT_CITY = 'New York'

/**
 * Placeholder "Saved Collections" tiles. Each links to the matching
 * filtered explore view so the tiles are no longer click-dead (QA pass 2).
 */
const PLACEHOLDER_COLLECTIONS = [
  {
    id: 'date-night',
    name: 'Date Night',
    type: 'Romance',
    image:
      'https://images.unsplash.com/photo-1722938687772-62a0dbfacc25?w=600&q=80',
    href: '/explore?cuisine=French',
  },
  {
    id: 'quick-lunch',
    name: 'Quick Lunch',
    type: 'Weekday',
    image:
      'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=600&q=80',
    href: '/explore?cuisine=Sandwich',
  },
  {
    id: 'special-occasions',
    name: 'Special Occasions',
    type: 'Celebration',
    image:
      'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=80',
    href: '/explore?accolade=michelin_star',
  },
  {
    id: 'hidden-gems',
    name: 'Hidden Gems',
    type: 'Discovery',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    href: '/explore?accolade=hidden_gems',
  },
]

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  // Home page "Suggestions" shows trending for a default city so the
  // mix isn't dominated by whichever city happens to have the loudest
  // 7-day engagement. `/explore` has a city selector; the home page
  // does not, so pinning it to NY matches the `/explore` default.
  const trendingRestaurants = await topTrendingRestaurants(supabase, {
    city: DEFAULT_CITY,
    window: '7d',
    limit: 8,
  })

  // Fallback: if trending has no results, show top-rated in the same city.
  let suggestions: Restaurant[] = trendingRestaurants
  if (suggestions.length === 0) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .ilike('city', DEFAULT_CITY)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(8)
    suggestions = (data ?? []) as Restaurant[]
  }

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <section className="mb-16">
          <SectionHeader label="Curated Selection" title="Suggestions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {suggestions.map((r) => (
              <SuggestionCard key={r.id} restaurant={r} />
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <section>
            <SectionHeader title="Recent Searches" />
            <RecentSearches />
          </section>

          <section>
            <SectionHeader title="Your Favorites" />
            <FavoritesSection />
          </section>
        </div>

        <section>
          <SectionHeader title="Saved Collections" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {PLACEHOLDER_COLLECTIONS.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className="overflow-hidden cursor-pointer transition-all hover:shadow-2xl group rounded-sm block"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="overflow-hidden relative rounded-sm aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt=""
                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                    <Bookmark className="h-6 w-6 text-white fill-white" />
                  </div>
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
