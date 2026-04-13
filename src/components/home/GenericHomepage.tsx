import Link from 'next/link'
import RestaurantCard from '@/components/RestaurantCard'
import CityCard from '@/components/CityCard'
import HeroSearchBar from '@/components/HeroSearchBar'
import {
  ArrowRight,
  TrendingUp,
  MapPin,
  BarChart3,
} from 'lucide-react'
import type { Restaurant, City } from '@/types/database'
import type { TrendingRestaurant } from '@/lib/placement'

interface GenericHomepageProps {
  trendingRestaurants: Restaurant[]
  trending?: TrendingRestaurant[]
  cities: City[]
  totalRestaurants: number
  totalCities: number
  showCityPicker?: boolean
}

export default function GenericHomepage({
  trendingRestaurants,
  trending = [],
  cities,
  totalRestaurants,
  totalCities,
}: GenericHomepageProps) {
  const topRestaurants = trendingRestaurants.slice(0, 12)

  return (
    <div className="min-h-screen">
      {/* Compact Hero with Search */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium mb-5">
              <BarChart3 size={12} />
              Every rating. One place.
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
              The truth about
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                every restaurant
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-400 max-w-xl mx-auto">
              Google, Yelp, The Infatuation, and Michelin ratings side by side.
            </p>

            {/* Inline Search */}
            <HeroSearchBar variant="dark" />

            {/* Stats */}
            <div className="mt-8 flex justify-center gap-8 sm:gap-16">
              {totalRestaurants > 0 && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {totalRestaurants.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">Restaurants</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">4</p>
                <p className="text-xs sm:text-sm text-gray-500">Rating Sources</p>
              </div>
              {totalCities > 0 && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {totalCities.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">Cities</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Top Restaurants — The Main Event */}
      {topRestaurants.length > 0 && (
        <section className="py-10 sm:py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Top Restaurants
                </h2>
              </div>
              <Link
                href="/restaurants"
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topRestaurants.map((restaurant, i) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  rank={i + 1}
                  showRank
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* City Row — single horizontal scroll on mobile, flex row on desktop */}
      {cities.length > 0 && (
        <section className="py-10 sm:py-14 bg-white border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Explore by city
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {cities.map((city) => (
                <CityCard key={city.id} city={city} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Restaurants */}
      {trending.length > 0 && (
        <section className="py-10 sm:py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Trending now
                </h2>
              </div>
              <Link
                href="/restaurants"
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {trending.slice(0, 8).map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  trendingTier={restaurant.trending_tier}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sticky signup banner (mobile) */}
      <div className="sticky bottom-0 z-40 bg-emerald-600 border-t border-emerald-500 py-3 px-4 text-center md:hidden">
        <Link
          href="/auth/signup"
          className="text-sm font-semibold text-white"
        >
          Create a free account for personalized recommendations &rarr;
        </Link>
      </div>
    </div>
  )
}
