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
      {/* Compact Welcome Banner with Search */}
      <section className="bg-gradient-to-r from-gray-900 to-emerald-950 text-white py-8 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Gastronome
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Every rating. One place.
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-sm text-gray-400 flex-wrap">
              {totalRestaurants > 0 && (
                <>
                  <span>
                    <span className="font-semibold text-white">
                      {totalRestaurants.toLocaleString()}
                    </span>{' '}
                    restaurants
                  </span>
                  <span className="text-gray-600">&middot;</span>
                </>
              )}
              {totalCities > 0 && (
                <>
                  <span>
                    <span className="font-semibold text-white">{totalCities}</span>{' '}
                    cities
                  </span>
                  <span className="text-gray-600">&middot;</span>
                </>
              )}
              <span>
                <span className="font-semibold text-white">4</span> sources
              </span>
            </div>
          </div>

          {/* Inline Search */}
          <HeroSearchBar variant="dark" />
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
