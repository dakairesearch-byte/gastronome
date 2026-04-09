'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StarRating from '@/components/StarRating'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { Restaurant } from '@/types/database'
import { AlertCircle, Loader2, X, Sparkles, Settings } from 'lucide-react'
import Link from 'next/link'

export default function NewReviewPage() {
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
      fetchRestaurants()

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
    }
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
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-8 sm:py-12">
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${creativeModeEnabled ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                {creativeModeEnabled ? 'Write a Review' : 'Quick Review'}
              </h1>
              <p className="text-lg text-gray-600">
                {creativeModeEnabled
                  ? 'Share your detailed dining experience with our community'
                  : 'Rate a restaurant in seconds'}
              </p>
            </div>
            {!creativeModeEnabled && (
              <Link
                href="/profile/edit"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 transition-colors"
                title="Enable Creative Mode in settings for detailed reviews"
              >
                <Sparkles size={14} />
                <span>Want more options?</span>
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Restaurant Selection */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Select a Restaurant
            </h2>

            {!showNewRestaurant ? (
              <>
                <GooglePlacesAutocomplete
                  onSelect={handleAutocompleteSelect}
                  placeholder="Search for a restaurant to review..."
                />

                {selectedRestaurantData && (
                  <div className="p-3 bg-white rounded border border-amber-100">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{selectedRestaurantData.name}</span>
                      {' \u2022 '}
                      <span className="text-gray-600">{selectedRestaurantData.cuisine}</span>
                      {' \u2022 '}
                      <span className="text-gray-600">{selectedRestaurantData.city}</span>
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
                    className="text-amber-600 hover:text-amber-700 font-medium text-sm transition-colors"
                  >
                    + Add a new restaurant not in our database
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newRestaurantCuisine}
                    onChange={(e) => setNewRestaurantCuisine(e.target.value)}
                    placeholder="Cuisine Type (e.g., Italian, Thai)"
                    required
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                  />
                  <input
                    type="text"
                    value={newRestaurantCity}
                    onChange={(e) => setNewRestaurantCity(e.target.value)}
                    placeholder="City"
                    required
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                  />
                </div>

                <input
                  type="text"
                  value={newRestaurantAddress}
                  onChange={(e) => setNewRestaurantAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range
                  </label>
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
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
                  className="text-sm text-gray-600 hover:text-gray-700 transition-colors"
                >
                  Back to search
                </button>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-900">
              Your Rating
            </label>
            <div className={`p-4 ${creativeModeEnabled ? 'p-6' : 'p-4'} bg-amber-50 rounded-xl border border-amber-200`}>
              <StarRating
                rating={rating}
                size={creativeModeEnabled ? 40 : 32}
                readonly={false}
                onRate={setRating}
              />
              {rating > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  You rated this restaurant <span className="font-bold text-amber-700">{rating} stars</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick Post: Simple one-liner field */}
          {!creativeModeEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Thought (optional)
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={280}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="e.g., Amazing tacos, best I've had in Miami!"
              />
              <p className="text-xs text-gray-500 mt-1">
                {content.length}/280 characters
              </p>
            </div>
          )}

          {/* Creative Mode: Full review fields */}
          {creativeModeEnabled && (
            <>
              {/* Review Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Amazing pasta dishes with cozy atmosphere"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {title.length}/100 characters
                </p>
              </div>

              {/* Review Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Review *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="Share your dining experience in detail. What did you order? How was the service? Would you recommend this restaurant?"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {content.length}/5000 characters (minimum 20 required)
                </p>
              </div>

              {/* Photo URL */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo URL (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => handlePhotoUrlChange(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                      placeholder="https://example.com/photo.jpg"
                    />
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => handlePhotoUrlChange('')}
                        className="px-4 py-3 text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Paste a direct link to a food photo (JPG, PNG, WebP).
                  </p>
                </div>

                {photoPreview && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Photo Preview:</p>
                    <div className="relative w-full max-w-md h-48 bg-gray-100 rounded-xl overflow-hidden border border-gray-300">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={() => setPhotoPreview('')}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Publishing...' : creativeModeEnabled ? 'Publish Review' : 'Post Review'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
