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

        const { data: reviewData } = await supabase
          .from('reviews')
          .select('*')
          .eq('id', reviewId)
          .single()

        if (!reviewData) {
          setError('Review not found')
          setLoading(false)
          return
        }

        if (reviewData.author_id !== session.user.id) {
          setError('You do not have permission to edit this review')
          setLoading(false)
          return
        }

        setReview(reviewData)
        setTitle(reviewData.title)
        setContent(reviewData.content)
        setRating(reviewData.rating)

        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', reviewData.restaurant_id)
          .single()

        setRestaurant(restaurantData)

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
        setSaving(false)
        return
      }

      if (title.trim().length === 0) {
        setError('Please enter a review title')
        setSaving(false)
        return
      }

      if (content.trim().length < 20) {
        setError('Review must be at least 20 characters long')
        setSaving(false)
        return
      }

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

      if (photoUrl.trim() && photoUrl !== (photos[0]?.photo_url || '')) {
        await supabase.from('review_photos').delete().eq('review_id', reviewId)
        await supabase.from('review_photos').insert([
          {
            review_id: reviewId,
            photo_url: photoUrl.trim(),
          },
        ])
      } else if (!photoUrl.trim() && photos.length > 0) {
        await supabase.from('review_photos').delete().eq('review_id', reviewId)
      }

      if (review.rating !== rating && restaurant) {
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('restaurant_id', restaurant.id)

        if (allReviews && allReviews.length > 0) {
          const newAvgRating =
            allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length

          await supabase
            .from('restaurants')
            .update({ avg_rating: newAvgRating })
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
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    )
  }

  if (!review || !restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-gray-500">Review not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Edit Review</h1>
          <p className="text-sm text-gray-500 mt-1">Update your review of {restaurant.name}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Restaurant Info */}
          <div className="p-4 bg-white rounded-lg border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Reviewing</p>
            <h2 className="text-base font-bold text-gray-900">{restaurant.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {restaurant.cuisine} &bull; {restaurant.city}
            </p>
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
              <p className="mt-2 text-xs text-gray-500">
                You rated this restaurant <span className="font-bold text-emerald-600">{rating} stars</span>
              </p>
            </div>
          </div>

          {/* Review Title */}
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
              placeholder="Summarize your experience..."
            />
            <p className="text-xs text-gray-400 mt-1">{title.length}/100</p>
          </div>

          {/* Review Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Review *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              minLength={20}
              maxLength={2000}
              rows={8}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none text-sm"
              placeholder="Share your dining experience..."
            />
            <p className="text-xs text-gray-400 mt-1">{content.length}/2000 (min 20)</p>
          </div>

          {/* Photo URL */}
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

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving || rating === 0}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
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
