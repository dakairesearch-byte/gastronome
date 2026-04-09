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
        let restaurantQuery = supabase.from('restaurants').select('*')

        if (searchQuery.trim()) {
          const sanitized = searchQuery.replace(/[%_\\]/g, '')
          restaurantQuery = restaurantQuery.or(
            `name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%,city.ilike.%${sanitized}%`
          )
        }

        if (selectedCuisines.length > 0) {
          restaurantQuery = restaurantQuery.in('cuisine', selectedCuisines)
        }

        const { data: restaurantData } = await restaurantQuery
          .order('avg_rating', { ascending: false })
          .limit(20)

        setRestaurants(restaurantData || [])

        let reviewsData: any[] = []
        if (searchQuery.trim()) {
          const { data: allReviews } = await supabase
            .from('reviews')
            .select('*')
            .or(`title.ilike.%${searchQuery.replace(/[%_\\]/g, '')}%,content.ilike.%${searchQuery.replace(/[%_\\]/g, '')}%`)
            .order('created_at', { ascending: false })
            .limit(20)

          if (allReviews) {
            const reviewsWithData = await Promise.all(
              allReviews.map(async (review) => {
                const [restaurant, author, photos] = await Promise.all([
                  supabase.from('restaurants').select('*').eq('id', review.restaurant_id).single(),
                  supabase.from('profiles').select('*').eq('id', review.author_id).single(),
                  supabase.from('review_photos').select('*').eq('review_id', review.id),
                ])
                return {
                  review,
                  restaurant: restaurant.data,
                  author: author.data,
                  photos: photos.data || [],
                }
              })
            )
            reviewsData = reviewsWithData.filter((item) => item.restaurant && item.author)
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

  const hasResults = restaurants.length > 0 || reviews.length > 0

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-500 mt-1">Find restaurants, reviews, and cuisines</p>
        </div>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search restaurants, dishes, or cuisines..."
          initialValue={searchQuery}
          onSearch={setSearchQuery}
        />

        {/* Cuisine Filters */}
        {availableCuisines.length > 0 && (
          <FilterChips
            cuisines={availableCuisines}
            selectedCuisines={selectedCuisines}
            onCuisineChange={handleCuisineChange}
            onClearAll={handleClearFilters}
          />
        )}

        {/* Tabs */}
        {hasResults && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'reviews'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Reviews ({reviews.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('restaurants')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'restaurants'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Restaurants ({restaurants.length})
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
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
            title={searchQuery || selectedCuisines.length > 0 ? 'No results found' : 'Start searching'}
            description={
              searchQuery || selectedCuisines.length > 0
                ? 'Try adjusting your filters or search terms'
                : 'Enter a restaurant name, cuisine, or dish to get started'
            }
            ctaText="Browse All Restaurants"
            ctaHref="/restaurants"
          />
        )}

        {/* Results */}
        {!loading && hasResults && (
          <>
            {activeTab === 'reviews' && reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map(({ review, restaurant, author, photos }) => (
                  <ReviewCard key={review.id} review={review} restaurant={restaurant} author={author} photos={photos} />
                ))}
              </div>
            ) : activeTab === 'restaurants' && restaurants.length > 0 ? (
              <div className="space-y-3">
                {restaurants.map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={UtensilsCrossed}
                title={`No ${activeTab} found`}
                description="Try switching tabs or adjusting your search filters"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SearchContent />
    </Suspense>
  )
}
