'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StarRating from '@/components/StarRating'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { Restaurant } from '@/types/database'
import { AlertCircle, Loader2, X, Sparkles, Settings } from 'lucide-react'
import Link from 'next/link'

function NewReviewContent() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [selectedRestaurantData, setSelectedRestaurantData] = useState<Restaurant | null>(null)
  const [newRestaurantName, setNewRestaurantName] = useState('')
  const [newRestaurantCuisine, setNewRestaurantCuisine] = useState('')
  const [newRestaurantCity, setNewRestaurantCity] = useState('')
  const [newRestaurantAddress, setNewRestaurantAddress] = useState('')
  const [priceRange, setPriceRange] = useState('1')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(0)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showNewRestaurant, setShowNewRestaurant] = useState(false)
  const [creativeModeEnabled, setCreativeModeEnabled] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      setUser(session.user)
      fetchRestaurants().then((data) => {
        // Pre-select restaurant from URL param
        const restaurantParam = searchParams.get('restaurant')
        if (restaurantParam && data.length > 0) {
          setSelectedRestaurant(restaurantParam)
          const found = data.find((r: Restaurant) => r.id === restaurantParam)
          if (found) setSelectedRestaurantData(found)
        }
        // Pre-fill new restaurant from URL params (from Google Places)
        const nameParam = searchParams.get('name')
        if (nameParam && !restaurantParam) {
          setShowNewRestaurant(true)
          setNewRestaurantName(nameParam)
          setNewRestaurantCity(searchParams.get('city') || '')
          setNewRestaurantAddress(searchParams.get('address') || '')
        }
      })

      // Check creative mode setting
      const { data: profile } = await supabase
        .from('profiles')
        .select('creative_mode_enabled')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setCreativeModeEnabled(profile.creative_mode_enabled || false)
      }
      setProfileLoading(false)
    }

    checkAuth()
  }, [supabase, router])

  const fetchRestaurants = async () => {
    const { data } = await supabase.from('restaurants').select('*').order('name')
    if (data) {
      setRestaurants(data)
      return data
    }
    return []
  }

  const handleRestaurantSelect = (restaurantId: string) => {
    setSelectedRestaurant(restaurantId)
    const restaurant = restaurants.find((r) => r.id === restaurantId)
    setSelectedRestaurantData(restaurant || null)
  }

  const handleAutocompleteSelect = (result: any) => {
    if (result.isFromGoogle) {
      setShowNewRestaurant(true)
      setNewRestaurantName(result.name)
      setNewRestaurantCity(result.city)
      setNewRestaurantAddress(result.address)
      setSelectedRestaurant('')
      setSelectedRestaurantData(null)
    } else {
      setShowNewRestaurant(false)
      handleRestaurantSelect(result.id)
    }
  }

  const handlePhotoUrlChange = (url: string) => {
    setPhotoUrl(url)
    if (url.trim()) {
      setPhotoPreview(url)
    } else {
      setPhotoPreview('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate before any API calls
      if (!showNewRestaurant && !selectedRestaurant) {
        setError('Please select or create a restaurant')
        setLoading(false)
        return
      }

      if (rating === 0) {
        setError('Please select a rating')
        setLoading(false)
        return
      }

      // For quick post mode, auto-generate title if empty
      const reviewTitle = creativeModeEnabled
        ? title
        : title.trim() || `${rating}-star review`

      const reviewContent = creativeModeEnabled
        ? content
        : content.trim() || `Rated ${rating} out of 5 stars.`

      if (creativeModeEnabled && reviewTitle.trim().length === 0) {
        setError('Please enter a review title')
        setLoading(false)
        return
      }

      if (creativeModeEnabled && reviewContent.trim().length < 20) {
        setError('Review must be at least 20 characters long')
        setLoading(false)
        return
      }

      let restaurantId = selectedRestaurant

      // Create new restaurant if needed
      if (showNewRestaurant && newRestaurantName) {
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert([
            {
              name: newRestaurantName,
              cuisine: newRestaurantCuisine,
              city: newRestaurantCity,
              address: newRestaurantAddress || null,
              price_range: parseInt(priceRange),
              review_count: 0,
              avg_rating: null,
            },
          ])
          .select()
          .single()

        if (createError) {
          setError('Failed to create restaurant: ' + createError.message)
          setLoading(false)
          return
        }

        restaurantId = newRestaurant.id
      }

      // Create review
      const { data: createdReview, error: reviewError } = await supabase
        .from('reviews')
        .insert([
          {
            restaurant_id: restaurantId,
            author_id: user.id,
            rating,
            title: reviewTitle,
            content: reviewContent,
          },
        ])
        .select()
        .single()

      if (reviewError) {
        setError('Failed to create review: ' + reviewError.message)
        return
      }

      // Add photo if provided (creative mode)
      if (photoUrl.trim() && createdReview) {
        await supabase.from('review_photos').insert([
          {
            review_id: createdReview.id,
            photo_url: photoUrl.trim(),
          },
        ])
      }

      // Update restaurant rating and review count
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      if (restaurant) {
        const currentAvgRating = restaurant.avg_rating || 0
        const newAvgRating =
          (currentAvgRating * restaurant.review_count + rating) /
          (restaurant.review_count + 1)

        await supabase
          .from('restaurants')
          .update({
            avg_rating: newAvgRating,
            review_count: restaurant.review_count + 1,
          })
          .eq('id', restaurantId)
      }

      router.push('/restaurants/' + restaurantId)
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!user || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {creativeModeEnabled ? 'Write a Review' : 'Quick Review'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {creativeModeEnabled
                  ? 'Share your detailed dining experience'
                  : 'Rate a restaurant in seconds'}
              </p>
            </div>
            {!creativeModeEnabled && (
              <Link
                href="/profile"
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                title="Enable Creative Mode in settings for detailed reviews"
              >
                <Sparkles size={14} />
                <span>More options</span>
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Restaurant Selection */}
          <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">
              Select a Restaurant
            </h2>

            {!showNewRestaurant ? (
              <>
                <GooglePlacesAutocomplete
                  onSelect={handleAutocompleteSelect}
                  placeholder="Search for a restaurant to review..."
                />

                {selectedRestaurantData && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{selectedRestaurantData.name}</span>
                      {' \u2022 '}
                      <span className="text-gray-500">{selectedRestaurantData.cuisine}</span>
                      {' \u2022 '}
                      <span className="text-gray-500">{selectedRestaurantData.city}</span>
                    </p>
                  </div>
                )}

                {!selectedRestaurantData && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewRestaurant(true)
                      setNewRestaurantName('')
                      setNewRestaurantCuisine('')
                      setNewRestaurantCity('')
                      setNewRestaurantAddress('')
                    }}
                    className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors"
                  >
                    + Add a new restaurant
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newRestaurantName}
                  onChange={(e) => setNewRestaurantName(e.target.value)}
                  placeholder="Restaurant Name"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newRestaurantCuisine}
                    onChange={(e) => setNewRestaurantCuisine(e.target.value)}
                    placeholder="Cuisine Type (e.g., Italian)"
                    required
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                  />
                  <input
                    type="text"
                    value={newRestaurantCity}
                    onChange={(e) => setNewRestaurantCity(e.target.value)}
                    placeholder="City"
                    required
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                  />
                </div>

                <input
                  type="text"
                  value={newRestaurantAddress}
                  onChange={(e) => setNewRestaurantAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price Range
                  </label>
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                  >
                    <option value="1">$ (Budget-Friendly)</option>
                    <option value="2">$$ (Moderate)</option>
                    <option value="3">$$$ (Upscale)</option>
                    <option value="4">$$$$ (Fine Dining)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowNewRestaurant(false)
                    setNewRestaurantName('')
                    setNewRestaurantCuisine('')
                    setNewRestaurantCity('')
                    setNewRestaurantAddress('')
                    setPriceRange('1')
                    setSelectedRestaurant('')
                    setSelectedRestaurantData(null)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Back to search
                </button>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Rating
            </label>
            <div className="p-4 bg-white rounded-lg border border-gray-100">
              <StarRating
                rating={rating}
                size={32}
                readonly={false}
                onRate={setRating}
              />
              {rating > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  You rated this restaurant <span className="font-bold text-emerald-600">{rating} stars</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick Post: Simple one-liner field */}
          {!creativeModeEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Thought (optional)
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={280}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                placeholder="e.g., Amazing tacos, best I've had!"
              />
              <p className="text-xs text-gray-400 mt-1">
                {content.length}/280
              </p>
            </div>
          )}

          {/* Creative Mode: Full review fields */}
          {creativeModeEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                  placeholder="e.g., Amazing pasta with cozy atmosphere"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {title.length}/100
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Review *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none text-sm"
                  placeholder="Share your dining experience in detail..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  {content.length}/5000 (min 20)
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo URL (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => handlePhotoUrlChange(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                      placeholder="https://example.com/photo.jpg"
                    />
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => handlePhotoUrlChange('')}
                        className="px-3 py-2 text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {photoPreview && (
                  <div className="relative w-full max-w-md h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={() => setPhotoPreview('')}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Publishing...' : creativeModeEnabled ? 'Publish Review' : 'Post Review'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>}>
      <NewReviewContent />
    </Suspense>
  )
}
