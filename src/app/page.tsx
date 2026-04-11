import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/RestaurantCard'
import ComingSoon from '@/components/ComingSoon'
import CityCard from '@/components/CityCard'
import { Search, ArrowRight, TrendingUp, MapPin, BarChart3, ThumbsUp } from 'lucide-react'

export const revalidate = 60

async function getHomePageData() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: featuredRestaurants } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_featured', true)
      .order('avg_rating', { ascending: false })
      .limit(8)

    const { data: trendingRestaurants } = await supabase
      .from('restaurants')
      .select('*')
      .gt('google_rating', 0)
      .order('google_rating', { ascending: false })
      .limit(12)

    const { data: cities } = await supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('restaurant_count', { ascending: false })
      .limit(6)

    const { count: totalRestaurants } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true })

    const { count: totalCities } = await supabase
      .from('cities')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return {
      featuredRestaurants: featuredRestaurants || [],
      trendingRestaurants: trendingRestaurants || [],
      cities: cities || [],
      totalRestaurants: totalRestaurants || 0,
      totalCities: totalCities || 0,
    }
  } catch {
    return { featuredRestaurants: [], trendingRestaurants: [], cities: [], totalRestaurants: 0, totalCities: 0 }
  }
}

export default async function Home() {
  const { featuredRestaurants, trendingRestaurants, cities, totalRestaurants, totalCities } = await getHomePageData()

  const displayRestaurants = featuredRestaurants.length > 0 ? featuredRestaurants : trendingRestaurants

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-32">
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
              Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.
            </p>

            {/* Stats */}
            <div className="mt-12 flex justify-center gap-8 sm:gap-16">
              {totalRestaurants > 0 && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-white">{totalRestaurants.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Restaurants</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">4</p>
                <p className="text-sm text-gray-500">Rating Sources</p>
              </div>
              {totalCities > 0 && (
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-white">{totalCities.toLocaleString()}</p>
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
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-12">How Gastronome works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Search</h3>
              <p className="text-sm text-gray-500">Find any restaurant across 20 major US cities</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <BarChart3 size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Compare</h3>
              <p className="text-sm text-gray-500">See Google, Yelp, Infatuation, and Michelin scores side by side</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <ThumbsUp size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Decide</h3>
              <p className="text-sm text-gray-500">Pick the right restaurant with confidence, every time</p>
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
                <h2 className="text-xl font-bold text-gray-900">Explore by city</h2>
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

      {/* Trending Restaurants */}
      {displayRestaurants.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">Trending restaurants</h2>
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
              {displayRestaurants.slice(0, 8).map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Coming Soon */}
      <ComingSoon />
    </div>
  )
}
