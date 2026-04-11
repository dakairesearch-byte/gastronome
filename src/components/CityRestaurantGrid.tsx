'use client'

import { useState } from 'react'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

interface CityRestaurantGridProps {
  restaurants: Restaurant[]
  cuisines: string[]
  cityName: string
}

export default function CityRestaurantGrid({ restaurants, cuisines, cityName }: CityRestaurantGridProps) {
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null)

  const filtered = selectedCuisine
    ? restaurants.filter((r) => r.cuisine === selectedCuisine)
    : restaurants

  return (
    <>
      {/* Cuisine filters */}
      {cuisines.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
          <button
            type="button"
            onClick={() => setSelectedCuisine(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
              selectedCuisine === null
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {cuisines.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              onClick={() => setSelectedCuisine(cuisine === selectedCuisine ? null : cuisine)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
                selectedCuisine === cuisine
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {cuisine}
            </button>
          ))}
        </div>
      )}

      {/* Restaurant Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MapPin}
          title="No restaurants found"
          description={
            selectedCuisine
              ? `No ${selectedCuisine} restaurants in ${cityName} yet`
              : `No restaurants in ${cityName} yet.`
          }
        />
      )}
    </>
  )
}
