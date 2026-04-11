'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import RestaurantCard from '@/components/RestaurantCard'
import { Clock } from 'lucide-react'
import { Restaurant } from '@/types/database'

export default function FeedPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRecentlyUpdated() {
      const supabase = createClient()

      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .order('last_fetched_at', { ascending: false, nullsFirst: false })
        .limit(30)

      setRestaurants(data || [])
      setLoading(false)
    }
    loadRecentlyUpdated()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-gray-100 rounded w-28" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">Recently Updated</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Restaurants with the latest rating updates
          </p>
        </div>

        {restaurants.length > 0 ? (
          <div className="space-y-3">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center bg-white rounded-xl border border-gray-100 p-10">
            <Clock size={36} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">No restaurants yet</h2>
            <p className="text-sm text-gray-500">
              Check back soon — we&apos;re adding new restaurants every day.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
