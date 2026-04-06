'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/SearchBar'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { ReviewCardSkeleton, RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Search, UtensilsCrossed } from 'lucide-react'
import { Restaurant, Review, Profile, ReviewPhoto } from '@/types/database'

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || searchParams.get('cuisine') || ''
  const [searchQuery, setSearchQuery] = useState(query)
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(
    searchParams.get('cuisine') ? [searchParams.get('cuisine')!] : []
  )
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reviews' | 'restaurants'>('reviews')
  const supabase = createClient()

  useEffect(() => {
    const fetchAllCuisines = async () => {
      const { data } = await supabase.from('restaurants').select('cuisine')
      if (data) {
        const cuisines = [...new Set(data.map((r) => r.cuisine))].sort()
        setAvailableCuisines(cuisines)
      }
    }
    fetchAllCuisines()
  }, [supabase])

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true)
      try {
        // Search restaurants
        let restaurantQuery = supabase.from('restaurants').select('*')

        if (searchQuery.trim()) {
          restaurantQuery = restaurantQuery.or(
            `name.ilike.%${searchQuery}%,cuisine.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`
          )
        }

        if (selectedCuisines.length > 0) {
          restaurantQuery = restaurantQuery.in('cuisine', selectedCuisines)
        }

        const { data: restaurantData } = await restaurantQuery
          .order('avg_rating', { ascending: false })
          .limit(20)

        setRestaurants(restaurantData || [])

        // Search reviews
        let reviewsData: any[] = []
        if (searchQuery.trim()) {
          const { data: allReviews } = await supabase
            .from('reviews')
            .select('*')
            .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
            .order('created_at', { ascending: false })
            .limit(20)

          if (allReviews) {
            const reviewsWithData = await Promise.all(
              allReviews.map(async (review) => {
                const [restaurant, author, photos] = await Promise.all([
                  supabase
                    .from('restaurants')
                    .select('*')
                    .eq('id', review.restaurant_id)
                    .single(),
                  supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', review.author_id)
                    .single(),
                  supabase
                    .from('review_photos')
                    .select('*')
                    .eq('review_id', review.id),
                ])

                return {
                  review,
                  restaurant: restaurant.data,
                  author: author.data,
                  photos: photos.data || [],
                }
              })
            )

            reviewsData = reviewsWithData.filter(
              (item) => item.restaurant && item.author
            )
          }
        }

        setReviews(reviewsData)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(performSearch, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedCuisines, supabase])

  const handleCuisineChange = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine]
    )
  }

  const handleClearFilters = () => {
    setSelectedCuisines([])
  }

  const displayedResults = activeTab === 'reviews' ? reviews : restaurants
  const hasResults = restaurants.length > 0 || reviews.length > 0
  const displayCount = activeTab === 'reviews' ? reviews.length : restaurants.length

  return (
    <div className="min-h-screen bg-white">
      {/* Search Header */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 py-8 sm:py-12 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Find Your Next Favorite Restaurant
            </h1>
            <p className="text-lg text-gray-600">
              Search reviews, restaurants, and cuisines from our community critics
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl">
            <SearchBar
              placeholder="Search restaurants, dishes, or cuisines..."
              initialValue={searchQuery}
              onSearch={setSearchQuery}
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
          <div className="lg:col-span-3 space-y-8">
            {/* Results Header */}
            {hasResults && (
              <div className="space-y-4">
                <div className="flex gap-2 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                      activeTab === 'reviews'
                        ? 'text-emerald-600 border-emerald-600'
                        : 'text-gray-600 border-transparent hover:text-gray-900'
                    }`}
                  >
                    Reviews ({reviews.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('restaurants')}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                      activeTab === 'restaurants'
                        ? 'text-emerald-600 border-emerald-600'
                        : 'text-gray-600 border-transparent hover:text-gray-900'
                    }`}
                  >
                    Restaurants ({restaurants.length})
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="space-y-6">
                {[1, 2, 3].map((i) =>
                  activeTab === 'reviews' ? (
                    <ReviewCardSkeleton key={i} />
                  ) : (
                    <RestaurantCardSkeleton key={i} />
                  )
                )}
              </div>
            )}

            {/* No Results */}
            {!loading && !hasResults && (
              <EmptyState
                icon={Search}
                title={
                  searchQuery || selectedCuisines.length > 0
                    ? 'No results found'
                    : 'Start searching'
                }
                description={
                  searchQuery || selectedCuisines.length > 0
                    ? 'Try adjusting your filters or search terms'
                    : 'Enter a restaurant name, cuisine, or dish to get started'
                }
                ctaText="Browse All Restaurants"
                ctaHref="/restaurants"
              />
            )}

            {/* Results Grid */}
            {!loading && hasResults && (
              <>
                {activeTab === 'reviews' && reviews.length > 0 ? (
                  <div className="space-y-6">
                    {reviews.map(({ review, restaurant, author, photos }) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        restaurant={restaurant}
                        author={author}
                        photos={photos}
                      />
                    ))}
                  </div>
                ) : activeTab === 'restaurants' && restaurants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {restaurants.map((restaurant) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={UtensilsCrossed}
                    title={`No ${activeTab} found`}
                    description={`Try switching tabs or adjusting your search filters`}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SearchContent />
    </Suspense>
  )
}
