'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlacedRestaurants } from '@/lib/placement'
import RestaurantCard from '@/components/RestaurantCard'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

const PAGE_SIZE = 20

function RestaurantsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') || 'all'
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'top' | 'new'>(
    (tabParam as 'all' | 'top' | 'new') || 'all'
  )
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const supabase = createClient()

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true)
      try {
        // Use placement algorithm for default ordering
        const placed = await getPlacedRestaurants(supabase, { limit: 100 })
        if (placed.length > 0) {
          setRestaurants(placed)
          const cuisines = [...new Set(placed.map((r) => r.cuisine))].sort()
          setAvailableCuisines(cuisines)
        } else {
          const { data } = await supabase.from('restaurants').select('*')
          if (data) {
            setRestaurants(data)
            const cuisines = [...new Set(data.map((r) => r.cuisine))].sort()
            setAvailableCuisines(cuisines)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    fetchRestaurants()
  }, [supabase])

  // Filter and sort
  let filtered = [...restaurants]

  if (selectedCuisines.length > 0) {
    filtered = filtered.filter((r) => selectedCuisines.includes(r.cuisine))
  }

  switch (activeTab) {
    case 'top':
      filtered = filtered.filter((r) => (r.google_rating || r.avg_rating || 0) > 0)
      filtered.sort((a, b) => (b.google_rating || b.avg_rating || 0) - (a.google_rating || a.avg_rating || 0))
      break
    case 'new':
      filtered.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      break
    default:
      // "All" tab preserves placement algorithm order from fetch
      break
  }

  const totalFiltered = filtered.length
  const displayedRestaurants = filtered.slice(0, displayCount)
  const hasMore = displayCount < totalFiltered

  const handleCuisineChange = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine) ? prev.filter((c) => c !== cuisine) : [...prev, cuisine]
    )
    setDisplayCount(PAGE_SIZE)
  }

  const handleClearFilters = () => {
    setSelectedCuisines([])
    setDisplayCount(PAGE_SIZE)
  }

  const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'top' as const, label: 'Top Rated' },
    { key: 'new' as const, label: 'Newest' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Explore restaurants</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare ratings across Google, Yelp, The Infatuation, and Michelin
          </p>
        </div>

        {/* Sticky Filter Bar */}
        <div className="sticky top-14 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 bg-gray-50/80 backdrop-blur-xl border-b border-gray-200 mb-6 space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key)
                  setDisplayCount(PAGE_SIZE)
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cuisine Filters */}
          {availableCuisines.length > 0 && (
            <FilterChips
              cuisines={availableCuisines}
              selectedCuisines={selectedCuisines}
              onCuisineChange={handleCuisineChange}
              onClearAll={handleClearFilters}
            />
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {Math.min(displayCount, totalFiltered)} of {totalFiltered} restaurant{totalFiltered !== 1 ? 's' : ''}
            </p>
            {selectedCuisines.length > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none rounded"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && totalFiltered === 0 && (
          <EmptyState
            icon={MapPin}
            title="No restaurants found"
            description={
              selectedCuisines.length > 0
                ? 'Try adjusting your cuisine filters'
                : 'No restaurants in our database yet'
            }
          />
        )}

        {/* Restaurant Grid */}
        {!loading && displayedRestaurants.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setDisplayCount((prev) => prev + PAGE_SIZE)}
                  className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
                >
                  Load more restaurants
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <RestaurantsContent />
    </Suspense>
  )
}
