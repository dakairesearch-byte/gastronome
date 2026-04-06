'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StarRating from '@/components/StarRating'
import { Review, ReviewPhoto, Restaurant } from '@/types/database'
import { AlertCircle, Loader2, X } from 'lucide-react'

export default function EditReviewPage() {
  const router = useRouter()
  const params = useParams()
  const reviewId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [photos, setPhotos] = useState<ReviewPhoto[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(0)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/auth/login')
          return
        }

        setUser(session.user)

        // Fetch review
        const { data: reviewData } = await supabase
          .from('reviews')
          .select('*')
          .eq('id', reviewId)
          .single()

        if (!reviewData) {
          router.push('/404')
          return
        }

        // Check ownership
        if (reviewData.author_id !== session.user.id) {
          router.push('/404')
          return
        }

        setReview(reviewData)
        setTitle(reviewData.title)
        setContent(reviewData.content)
        setRating(reviewData.rating)

        // Fetch restaurant
        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', reviewData.restaurant_id)
          .single()

        setRestaurant(restaurantData)

        // Fetch photos
        const { data: photosData } = await supabase
          .from('review_photos')
          .select('*')
          .eq('review_id', reviewId)

        if (photosData) {
          setPhotos(photosData)
          if (photosData.length > 0) {
            setPhotoUrl(photosData[0].photo_url)
            setPhotoPreview(photosData[0].photo_url)
          }
        }
      } catch (err) {
        setError('Failed to load review')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [reviewId, supabase, router])

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
    setSaving(true)

    try {
      if (!review) return

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

      // Update review
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          title,
          content,
          rating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId)

      if (updateError) {
        setError('Failed to update review: ' + updateError.message)
        return
      }

      // Handle photos
      if (photoUrl.trim() && photoUrl !== (photos[0]?.photo_url || '')) {
        // Delete old photos
        await supabase.from('review_photos').delete().eq('review_id', reviewId)

        // Add new photo
        await supabase.from('review_photos').insert([
          {
            review_id: reviewId,
            photo_url: photoUrl.trim(),
          },
        ])
      } else if (!photoUrl.trim() && photos.length > 0) {
        // Delete photos if URL is cleared
        await supabase.from('review_photos').delete().eq('review_id', reviewId)
      }

      // Update restaurant rating if rating changed
      if (review.rating !== rating && restaurant) {
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('restaurant_id', restaurant.id)

        if (allReviews) {
          // Update the current review's rating in the array
          const updatedRatings = allReviews.map((r) =>
            r.rating === review.rating ? rating : r.rating
          )
          const newAvgRating =
            updatedRatings.reduce((a, b) => a + b, 0) / updatedRatings.length

          await supabase
            .from('restaurants')
            .update({
              avg_rating: newAvgRating,
            })
            .eq('id', restaurant.id)
        }
      }

      router.push(`/restaurants/${restaurant?.id}`)
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    )
  }

  if (!review || !restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Review not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Edit Your Review
          </h1>
          <p className="text-lg text-gray-600">
            Update your review of {restaurant.name}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Restaurant Info */}
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <p className="text-sm text-gray-600 mb-2">Reviewing</p>
            <h2 className="text-2xl font-bold text-gray-900">
              {restaurant.name}
            </h2>
            <p className="text-gray-600 mt-1">
              {restaurant.cuisine} • {restaurant.city}
            </p>
          </div>

          {/* Rating */}
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-900">
              Your Rating
            </label>
            <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200">
              <StarRating
                rating={rating}
                size={40}
                readonly={false}
                onRate={setRating}
              />
              <p className="mt-4 text-sm text-gray-600">
                You rated this restaurant <span className="font-bold text-emerald-700">{rating} stars</span>
              </p>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
              placeholder="Summarize your experience..."
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none"
              placeholder="Share your dining experience..."
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
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
            </div>

            {/* Photo Preview */}
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

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving || rating === 0}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
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
