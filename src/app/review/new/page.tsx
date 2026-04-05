'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StarRating from '@/components/StarRating'
import GooglePlacesAutocomplete, {
  GooglePlacesResult,
} from '@/components/GooglePlacesAutocomplete'
import { Restaurant } from '@/types/database'
import { AlertCircle, Loader2, Image as ImageIcon, X } from 'lucide-react'

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
      // Google Places result - auto-fill the new restaurant form
      setShowNewRestaurant(true)
      setNewRestaurantName(result.name)
      setNewRestaurantCity(result.city)
      setNewRestaurantAddress(result.address)
      setSelectedRestaurant('')
      setSelectedRestaurantData(null)
    } else {
      // Local restaurant result
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
              review_count: 1,
              avg_rating: rating,
            },
          ])
          .select()
          .single()

        if (createError) {
          setError('Failed to create restaurant: ' + createError.message)
          return
        }

        restaurantId = newRestaurant.id
      }

      if (!restaurantId) {
        setError('Please select or create a restaurant')
        return
      }

      if (rating === 0) {
        setError('Please select a rating')
        return
      }

      if (title.trim().length === 0) {
        setError('Please enter a review title')
        return
      }

      if (content.trim().length < 20) {
        setError('Review must be at least 20 characters long')
        return
      }

      // Create review
      const { data: createdReview, error: reviewError } = await supabase
        .from('reviews')
        .insert([
          {
            restaurant_id: restaurantId,
            author_id: user.id,
            rating,
            title,
            content,
          },
        ])
        .select()
        .single()

      if (reviewError) {
        setError('Failed to create review: ' + reviewError.message)
        return
      }

      // Add photo if provided
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Write a Review
          </h1>
          <p className="text-lg text-gray-600">
            Share your dining experience with our community
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Restaurant Selection */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200">
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
                      {' â¢ '}
                      <span className="text-gray-600">{selectedRestaurantData.cuisine}</span>
                      {' â¢ '}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newRestaurantCuisine}
                    onChange={(e) => setNewRestaurantCuisine(e.target.value)}
                    placeholder="Cuisine Type (e.g., Italian, Thai)"
                    required
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                  />
                  <input
                    type="text"
                    value={newRestaurantCity}
                    onChange={(e) => setNewRestaurantCity(e.target.value)}
                    placeholder="City"
                    required
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                  />
                </div>

                <input
                  type="text"
                  value={newRestaurantAddress}
                  onChange={(e) => setNewRestaurantAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range
                  </label>
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white"
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
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900">
              Your Rating
            </label>
            <div className="p-6 bg-amber-50 rounded-lg border border-amber-200">
              <StarRating
                rating={rating}
                size={40}
                readonly={false}
                onRate={setRating}
              />
              {rating > 0 && (
                <p className="mt-4 text-sm text-gray-600">
                  You rated this restaurant <span className="font-bold text-amber-700">{rating} stars</span>
                </p>
              )}
            </div>
          </div>

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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
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
              maxLength={2000}
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition resize-none"
              placeholder="Share your dining experience in detail. What did you order? How was the service? Would you recommend this restaurant?"
            />
            <p className="text-xs text-gray-500 mt-1">
              {content.length}/2000 characters (minimum 20 required)
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
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
                Paste a direct link to a food photo (JPG, PNG, WebP). We recommend high-quality photos of your dish.
              </p>
            </div>

            {/* Photo Preview */}
            {photoPreview && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Photo Preview:</p>
                <div className="relative w-full max-w-md h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => setPhotoPreview('')}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  If the image doesn't load, check that the URL is correct and publicly accessible.
                </p>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Publishing Review...' : 'Publish Review'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
