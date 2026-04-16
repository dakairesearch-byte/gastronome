import { Bookmark } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import SuggestionCard from '@/components/cards/SuggestionCard'
import RecentSearches from '@/components/home/RecentSearches'
import FavoritesSection from '@/components/home/FavoritesSection'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

/** Placeholder collections shown in the "Saved Collections" grid. */
const PLACEHOLDER_COLLECTIONS = [
  {
    id: 'date-night',
    name: 'Date Night Spots',
    type: 'Romance',
    image:
      'https://images.unsplash.com/photo-1722938687772-62a0dbfacc25?w=400&q=80',
  },
  {
    id: 'quick-lunch',
    name: 'Quick Lunch',
    type: 'Weekday',
    image:
      'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=400&q=80',
  },
]

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  // Use the trending ranker for "Suggestions" (replaces mock data)
  const trendingRestaurants = await topTrendingRestaurants(supabase, {
    window: '7d',
    limit: 8,
  })

  // Fallback: if trending has no results, show top-rated
  let suggestions: Restaurant[] = trendingRestaurants
  if (suggestions.length === 0) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(8)
    suggestions = (data ?? []) as Restaurant[]
  }

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* ── Suggestions ── */}
        <section className="mb-20">
          <SectionHeader label="Curated Selection" title="Suggestions" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {suggestions.map((r) => (
              <SuggestionCard key={r.id} restaurant={r} />
            ))}
          </div>
        </section>

        {/* ── Recent Searches & Favorites — magazine 2-col layout ── */}
        <div className="grid lg:grid-cols-2 gap-12 mb-20">
          <section>
            <div className="mb-2">
              <h2
                className="text-3xl sm:text-4xl mb-2"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: "'Spectral', serif",
                  fontWeight: 400,
                }}
              >
                Recent Searches
              </h2>
              <div className="w-10 h-px" style={{ backgroundColor: 'var(--color-accent)' }} />
            </div>
            <RecentSearches />
          </section>

          <section>
            <div className="mb-2">
              <h2
                className="text-3xl sm:text-4xl mb-2"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: "'Spectral', serif",
                  fontWeight: 400,
                }}
              >
                Your Favorites
              </h2>
              <div className="w-10 h-px" style={{ backgroundColor: 'var(--color-accent)' }} />
            </div>
            <FavoritesSection />
          </section>
        </div>

        {/* ── Saved Collections ── */}
        <section>
          <div className="mb-3">
            <h2
              className="text-3xl sm:text-4xl mb-2"
              style={{
                color: 'var(--color-text)',
                fontFamily: "'Spectral', serif",
                fontWeight: 400,
              }}
            >
              Saved Collections
            </h2>
            <div className="w-12 h-px mt-2" style={{ backgroundColor: 'var(--color-accent)' }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {PLACEHOLDER_COLLECTIONS.map((c) => (
              <div
                key={c.id}
                className="overflow-hidden cursor-pointer transition-all hover:shadow-2xl group rounded-sm"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="overflow-hidden relative rounded-sm" style={{ height: '120px' }}>
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
                <div className="p-3">
                  <h3
                    className="text-sm mb-1"
                    style={{
                      color: 'var(--color-text)',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    {c.name}
                  </h3>
                  <p
                    className="text-xs uppercase tracking-wider"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: '0.08em',
                    }}
                  >
                    {c.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
