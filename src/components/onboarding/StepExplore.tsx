'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RestaurantCard from '@/components/RestaurantCard'
import { MapPin, Loader2 } from 'lucide-react'
import type { City, Restaurant } from '@/types/database'

interface StepExploreProps {
  cities: City[]
  onNext: () => void
}

export default function StepExplore({ cities, onNext }: StepExploreProps) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)

  const handleCityClick = async (cityName: string) => {
    setSelectedCity(cityName)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('city', cityName)
        .order('google_rating', { ascending: false })
        .limit(3)
      setRestaurants(data || [])
    } catch {
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50 py-16">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
          Your City. Your Taste.{' '}
          <span className="text-emerald-600">Your Call.</span>
        </h1>

        <p className="text-gray-500">
          Tap a city to preview top-rated restaurants.
        </p>

        {/* City selector pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {cities.map((city) => (
            <button
              key={city.id}
              onClick={() => handleCityClick(city.name)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                selectedCity === city.name
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <MapPin size={14} className="inline mr-1 -mt-0.5" />
              {city.name}
            </button>
          ))}
        </div>

        {/* Restaurant preview */}
        {selectedCity && (
          <div className="text-left space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              Top rated in {selectedCity}
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-emerald-500" />
              </div>
            ) : restaurants.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {restaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                No restaurants found in this city yet.
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-gray-400">
          Browse by cuisine, neighborhood, or just see what&apos;s trending.
        </p>

        <button
          onClick={onNext}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          Get Personalized Picks &rarr;
        </button>
      </div>
    </div>
  )
}
