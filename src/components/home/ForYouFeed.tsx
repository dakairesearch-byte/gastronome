'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopRestaurantCard from './TopRestaurantCard'
import RestaurantCard from '@/components/RestaurantCard'
import CityCard from '@/components/CityCard'
import { ArrowRight, Clock, Flame, MapPin } from 'lucide-react'
import type { Restaurant, City, Profile } from '@/types/database'
import type { TrendingRestaurant } from '@/lib/placement'

interface ForYouFeedProps {
  profile: Profile
  topRestaurants: Restaurant[]
  recentRestaurants: Restaurant[]
  otherCities: City[]
  trendingRestaurants: TrendingRestaurant[]
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ForYouFeed({
  profile,
  topRestaurants,
  recentRestaurants,
  otherCities,
  trendingRestaurants,
}: ForYouFeedProps) {
  const [greeting, setGreeting] = useState('Welcome back')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  const firstName = profile.display_name.split(' ')[0]
  const cityName = profile.home_city || 'your city'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact hero */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {greeting}, {firstName}
          </h1>
          <p className="text-gray-400 mt-1">
            Here&apos;s what&apos;s trending in {cityName}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Top 10 */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Top 10 in {cityName}
            </h2>
            <Link
              href="/restaurants"
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {topRestaurants.length > 0 ? (
            <div className="space-y-3">
              {topRestaurants.map((restaurant, i) => (
                <TopRestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  rank={i + 1}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-sm text-gray-500">
                We&apos;re still adding restaurants in {cityName}. Check back
                soon!
              </p>
            </div>
          )}
        </section>

        {/* Recently Added */}
        {recentRestaurants.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock size={18} className="text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Recently Added in {cityName}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                />
              ))}
            </div>
          </section>
        )}

        {/* Explore Other Cities */}
        {otherCities.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Explore Other Cities
                </h2>
              </div>
              <Link
                href="/cities"
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                All cities <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {otherCities.slice(0, 6).map((city) => (
                <CityCard key={city.id} city={city} />
              ))}
            </div>
          </section>
        )}

        {/* Trending Near You */}
        {trendingRestaurants.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Flame size={18} className="text-orange-500" />
              <h2 className="text-xl font-bold text-gray-900">
                Trending in {cityName}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingRestaurants.slice(0, 6).map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  trendingTier={restaurant.trending_tier}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
