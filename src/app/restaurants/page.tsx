'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import RestaurantCard from '@/components/RestaurantCard'
import SearchBar from '@/components/SearchBar'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'rating' | 'reviews' | 'newest'>('rating')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
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

          {/* Search Bar */}
          <div className="max-w-2xl">
            <SearchBar
              placeholder="Search by name, cuisine, or city..."
              onSearch={setSearchQuery}
              initialValue={searchQuery}
            />
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-sm"
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
