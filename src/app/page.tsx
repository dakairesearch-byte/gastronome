import Link from 'next/link'
import { Clock, MapPin } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCitiesWithLiveCounts } from '@/lib/cities'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import HeroSearchBar from '@/components/HeroSearchBar'
import TrendingRail from '@/components/home/TrendingRail'
import JustAddedCard from '@/components/cards/JustAddedCard'
import CityCard from '@/components/CityCard'
import type { City } from '@/types/database'

// Home city used for the "Trending in X" rail when we have no
// geolocation signal and no logged-in profile city. NYC has the most
// data, so it's the best default.
const DEFAULT_HOME_CITY = 'New York'

// TODO: when auth ships a real user model, prepend "Friends activity"
// and "Saved with new content" sections above the global rails for
// logged-in users. For now Home is identical across auth state.

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const [
    trendingGlobal,
    trendingInCity,
    { data: justAdded },
    cities,
    { count: totalRestaurants },
  ] = await Promise.all([
    topTrendingRestaurants(supabase, { window: '7d', limit: 10 }),
    topTrendingRestaurants(supabase, {
      window: '7d',
      limit: 10,
      city: DEFAULT_HOME_CITY,
    }),
    supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8),
    getCitiesWithLiveCounts(supabase),
    supabase.from('restaurants').select('*', { count: 'exact', head: true }),
  ])

  const liveTotal = totalRestaurants ?? 0
  const cityCardRows: City[] = cities.slice(0, 6).map((c) => ({
    ...c,
    restaurant_count: c.live_restaurant_count,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Gastronome
              </h1>
              <p className="mt-1 text-gray-400 text-sm">
                Every restaurant rating in one place.
              </p>
            </div>
            {liveTotal > 0 && (
              <div className="text-sm text-gray-400">
                <span className="font-extrabold text-white text-lg">
                  {liveTotal.toLocaleString()}
                </span>{' '}
                restaurants tracked across{' '}
                <span className="font-semibold text-white">{cities.length}</span>{' '}
                {cities.length === 1 ? 'city' : 'cities'}
              </div>
            )}
          </div>
          <div className="mt-6">
            <HeroSearchBar variant="dark" />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {/* Trending This Week */}
        <TrendingRail
          title="Trending this week"
          subtitle="Most engagement across videos, reviews, and photos in the last 7 days"
          restaurants={trendingGlobal}
          viewAllHref="/explore"
        />

        {/* Trending In Default City */}
        <TrendingRail
          title={`Trending in ${DEFAULT_HOME_CITY}`}
          subtitle="Same signal, scoped to one city so high-volume cities don't drown low-volume ones"
          restaurants={trendingInCity}
          cityScope={DEFAULT_HOME_CITY}
          viewAllHref={`/explore?city=${encodeURIComponent(DEFAULT_HOME_CITY)}`}
        />

        {/* Just Added */}
        {justAdded && justAdded.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                  Just added
                </h2>
              </div>
              <Link
                href="/recent"
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                See the feed →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {justAdded.map((r) => (
                <JustAddedCard key={r.id} restaurant={r} />
              ))}
            </div>
          </section>
        )}

        {/* Browse by city */}
        {cityCardRows.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} className="text-emerald-600" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                Browse by city
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {cityCardRows.map((c) => (
                <CityCard key={c.id} city={c} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
