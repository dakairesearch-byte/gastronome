'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RestaurantCard from '@/components/RestaurantCard'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Restaurant } from '@/types/database'
import { MapPin, Search, X, Star } from 'lucide-react'

function RestaurantsContent() {
  const searchParams = useSearchParams()
  const cityParam = searchParams.get('city') || ''
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'rating' | 'reviews' | 'newest'>('rating')
  const [searchQuery, setSearchQuery] = useState(cityParam)
  const [inputValue, setInputValue] = useState(cityParam)
  const [suggestions, setSuggestions] = useState<Restaurant[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(true)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('restaurants').select('*')
        if (data) {
          setRestaurants(data)
          // Extract unique cuisines
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

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.city.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by cuisines
    if (selectedCuisines.length > 0) {
      filtered = filtered.filter((r) => selectedCuisines.includes(r.cuisine))
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
        break
      case 'reviews':
        filtered.sort((a, b) => b.review_count - a.review_count)
        break
      case 'newest':
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
    }

    setFilteredRestaurants(filtered)
  }, [restaurants, selectedCuisines, sortBy, searchQuery])

  // Update suggestions as input changes
  useEffect(() => {
    if (!inputValue.trim() || restaurants.length === 0) {
      setSuggestions([])
      return
    }
    const q = inputValue.toLowerCase()
    const matches = restaurants
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      )
      .slice(0, 5)
    setSuggestions(matches)
  }, [inputValue, restaurants])

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchInput = (value: string) => {
    setInputValue(value)
    setSearchQuery(value)
    setShowSuggestions(value.trim().length > 0)
  }

  const handleSelectSuggestion = (restaurant: Restaurant) => {
    setShowSuggestions(false)
    setInputValue('')
    setSearchQuery('')
    router.push(`/restaurants/${restaurant.id}`)
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 py-8 sm:py-12 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Discover Restaurants
            </h1>
            <p className="text-lg text-gray-600">
              Browse restaurants reviewed by our community of food critics
            </p>
          </div>

          {/* Live Search */}
          <div className="max-w-2xl" ref={searchContainerRef}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => inputValue.trim() && setShowSuggestions(true)}
                placeholder="Search by name, cuisine, or city..."
                className="w-full px-4 py-3 pl-12 pr-12 text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
              />
              {inputValue && (
                <button
                  onClick={() => { setInputValue(''); setSearchQuery(''); setSuggestions([]); setShowSuggestions(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-80 overflow-y-auto">
                  <ul className="py-2">
                    {suggestions.map((restaurant) => (
                      <li
                        key={restaurant.id}
                        onClick={() => handleSelectSuggestion(restaurant)}
                        className="px-4 py-3 cursor-pointer hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{restaurant.name}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <span>{restaurant.cuisine}</span>
                              <span>&middot;</span>
                              <MapPin size={12} className="flex-shrink-0" />
                              <span className="truncate">{restaurant.city}</span>
                            </p>
                          </div>
                          {restaurant.avg_rating != null && restaurant.avg_rating > 0 && (
                            <span className="flex items-center gap-1 text-sm text-amber-600 font-medium flex-shrink-0">
                              <Star size={14} className="fill-amber-400 text-amber-400" />
                              {restaurant.avg_rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Sort Options */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Sort By</h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-sm"
                >
                  <option value="rating">Top Rated</option>
                  <option value="reviews">Most Reviewed</option>
                  <option value="newest">Newest</option>
                </select>
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
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {filteredRestaurants.length} Restaurant
                {filteredRestaurants.length !== 1 ? 's' : ''}
              </h2>
              {(selectedCuisines.length > 0 || searchQuery) && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-amber-600 hover:text-amber-700 transition-colors font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <RestaurantCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredRestaurants.length === 0 && (
              <EmptyState
                icon={MapPin}
                title="No restaurants found"
                description={
                  selectedCuisines.length > 0 || searchQuery
                    ? 'Try adjusting your filters or search terms'
                    : 'No restaurants in our database yet'
                }
                ctaText="View all restaurants"
                ctaHref="/restaurants"
              />
            )}

            {/* Results Grid */}
            {!loading && filteredRestaurants.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredRestaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RestaurantsContent />
    </Suspense>
  )
}
