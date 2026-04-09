'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import RatingBadge from './RatingBadge'
import { Review, Profile, Restaurant, ReviewPhoto } from '@/types/database'
import { Share2, Trash2, Edit2, MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ReviewCardProps {
  review: Review
  restaurant: Restaurant | null
  author: Profile | null
  photos?: ReviewPhoto[]
  isOwnReview?: boolean
  onDelete?: (reviewId: string) => void
}

export default function ReviewCard({
  review,
  restaurant,
  author,
  photos,
  isOwnReview = false,
  onDelete,
}: ReviewCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  if (!restaurant || !author) {
    return null
  }

  const photoUrl = photos?.[0]?.photo_url
  const timeAgo = formatDistanceToNow(new Date(review.created_at), {
    addSuffix: true,
  })

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this review?')) return

    setIsDeleting(true)
    try {
      await supabase
        .from('review_photos')
        .delete()
        .eq('review_id', review.id)

      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', review.id)

      if (error) throw error

      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurant.id)
        .single()

      if (restaurantData) {
        const newReviewCount = Math.max(0, restaurantData.review_count - 1)
        let newAvgRating: number | null = null

        if (newReviewCount > 0) {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('restaurant_id', restaurant.id)

          if (reviews && reviews.length > 0) {
            newAvgRating =
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          }
        }

        await supabase
          .from('restaurants')
          .update({
            review_count: newReviewCount,
            avg_rating: newAvgRating,
          })
          .eq('id', restaurant.id)
      }

      if (onDelete) {
        onDelete(review.id)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting review:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/restaurants/${restaurant.id}`
    if (navigator.share) {
      navigator.share({
        title: review.title,
        text: `Check out this review of ${restaurant.name} by ${author.display_name}`,
        url,
      })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <article className="bg-white rounded-lg border border-gray-100 overflow-hidden transition-all duration-150 hover:shadow-md">
      {/* Author bar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href={`/profile/${author.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
          {author.avatar_url ? (
            <Image
              src={author.avatar_url}
              alt={author.display_name}
              width={36}
              height={36}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-gray-500">
                {author.display_name[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {author.display_name}
            </p>
            <p className="text-xs text-gray-400">{timeAgo}</p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            className="p-1.5 text-gray-300 hover:text-gray-500 rounded-full hover:bg-gray-50 transition-colors"
            aria-label="Share review"
          >
            <Share2 size={15} />
          </button>

          {isOwnReview && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 text-gray-300 hover:text-gray-500 rounded-full hover:bg-gray-50 transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal size={15} />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                  <Link
                    href={`/review/${review.id}/edit`}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit2 size={14} />
                    Edit
                  </Link>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      handleDelete()
                    }}
                    disabled={isDeleting}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Restaurant + Rating row */}
      <Link href={`/restaurants/${restaurant.id}`}>
        <div className="flex items-center gap-3 px-4 pb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">
              {restaurant.name}
            </h3>
            <p className="text-xs text-gray-400">
              {restaurant.cuisine} &middot; {restaurant.city}
            </p>
          </div>
          <RatingBadge rating={review.rating} size="sm" />
        </div>
      </Link>

      {/* Photo */}
      {photoUrl && (
        <Link href={`/restaurants/${restaurant.id}`}>
          <div className="relative w-full aspect-[4/3] bg-gray-50">
            <Image
              src={photoUrl}
              alt={review.title}
              fill
              className="object-cover"
              priority={false}
            />
          </div>
        </Link>
      )}

      {/* Review content */}
      <div className="px-4 py-3 space-y-1.5">
        <h4 className="font-medium text-gray-900 text-sm">{review.title}</h4>
        <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
          {review.content}
        </p>
      </div>
    </article>
  )
}
