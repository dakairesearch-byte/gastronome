import Link from 'next/link'
import RestaurantCard from '@/components/RestaurantCard'
import CityCard from '@/components/CityCard'
import {
  Search,
  ArrowRight,
  TrendingUp,
  MapPin,
  BarChart3,
  ThumbsUp,
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
  // Use placement-ordered restaurants directly
  const displayRestaurants = trendingRestaurants.slice(0, 8)

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium mb-6">
              <BarChart3 size={12} />
              Every rating. One place.
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight">
              The truth about
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                every restaurant
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-xl mx-auto">
              Google, Yelp, The Infatuation, and Michelin ratings side by side.
              Like Rotten Tomatoes, but for food.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/signup"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-emerald-900/30"
              >
                Get Started — It&apos;s Free
              </Link>
              <Link
                href="/restaurants"
                className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold text-sm transition-colors border border-white/20"
              >
                Browse Restaurants
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 flex justify-center gap-8 sm:gap-16">
              {totalRestaurants > 0 && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {totalRestaurants.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Restaurants</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">4</p>
                <p className="text-sm text-gray-500">Rating Sources</p>
              </div>
              {totalCities > 0 && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {totalCities.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Cities</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-12">
            How Gastronome works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Search</h3>
              <p className="text-sm text-gray-500">
                Find any restaurant across major US cities
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <BarChart3 size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Compare</h3>
              <p className="text-sm text-gray-500">
                See Google, Yelp, Infatuation, and Michelin scores side by side
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <ThumbsUp size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Decide</h3>
              <p className="text-sm text-gray-500">
                Pick the right restaurant with confidence, every time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* City Grid */}
      {cities.length > 0 && (
        <section className="py-14 sm:py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Explore by city
                </h2>
              </div>
              <Link
                href="/cities"
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                All cities
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {cities.map((city) => (
                <CityCard key={city.id} city={city} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Restaurants (placement-ordered) */}
      {displayRestaurants.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Top restaurants
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Restaurants */}
      {trending.length > 0 && (
        <section className="py-14 sm:py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Sticky signup banner */}
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
