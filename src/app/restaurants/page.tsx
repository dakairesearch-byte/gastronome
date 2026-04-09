'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RestaurantCard from '@/components/RestaurantCard'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Restaurant } from '@/types/database'
import { Search, X, MapPin } from 'lucide-react'

function RestaurantsContent() {
  const searchParams = useSearchParams()
  const cityParam = searchParams.get('city') || ''
  const tabParam = searchParams.get('tab') || 'all'
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'top' | 'new'>(tabParam as any || 'all')
  const [searchQuery, setSearchQuery] = useState(cityParam)
  const [inputValue, setInputValue] = useState(cityParam)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('restaurants').select('*')
        if (data) {
          setRestaurants(data)
          const cuisines = [...new Set(data.map((r) => r.cuisine))].sort()
          setAvailableCuisines(cuisines)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchRestaurants()
  }, [supabase])

  useEffect(() => {
    let filtered = [...restaurants]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      )
    }

    if (selectedCuisines.length > 0) {
      filtered = filtered.filter((r) => selectedCuisines.includes(r.cuisine))
    }

    switch (activeTab) {
      case 'top':
        filtered = filtered.filter((r) => r.avg_rating && r.avg_rating > 0)
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
        break
      case 'new':
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
      default:
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    }

    setFilteredRestaurants(filtered)
  }, [restaurants, selectedCuisines, activeTab, searchQuery])

  const handleSearchInput = (value: string) => {
    setInputValue(value)
    setSearchQuery(value)
  }

  const handleCuisineChange = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine]
    )
  }

  const handleClearFilters = () => {
    setSelectedCuisines([])
    setSearchQuery('')
    setInputValue('')
  }

  const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'top' as const, label: 'Top Rated' },
    { key: 'new' as const, label: 'New' },
  ]

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Explore</h1>
          <p className="text-sm text-gray-500 mt-1">Discover restaurants reviewed by our community</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search by name, cuisine, or city..."
            className="w-full py-2.5 pl-10 pr-10 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => { setInputValue(''); setSearchQuery('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
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
        <p className="text-xs text-gray-400">
          {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
          {(selectedCuisines.length > 0 || searchQuery) && (
            <button type="button" onClick={handleClearFilters} className="ml-2 text-amber-600 hover:text-amber-700 font-medium">
              Clear filters
            </button>
          )}
        </p>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filteredRestaurants.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No restaurants found"
            description={
              selectedCuisines.length > 0 || searchQuery
                ? 'Try adjusting your filters or search terms'
                : 'No restaurants in our database yet'
            }
          />
        )}

        {/* Restaurant List */}
        {!loading && filteredRestaurants.length > 0 && (
          <div className="space-y-3">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <RestaurantsContent />
    </Suspense>
  )
}
