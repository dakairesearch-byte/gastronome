'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import StarRating from './StarRating'
import { Review, Profile, Restaurant, ReviewPhoto } from '@/types/database'
import { Share2, Trash2, Edit2, ThumbsUp } from 'lucide-react'
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
      // Delete review photos
      await supabase
        .from('review_photos')
        .delete()
        .eq('review_id', review.id)

      // Delete review
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', review.id)

      if (error) throw error

      // Update restaurant stats
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
    <article className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-amber-50 group">
      {photoUrl && (
        <Link href={`/restaurants/${restaurant.id}`}>
          <div className="relative w-full h-48 sm:h-56 bg-gray-100 overflow-hidden">
            <Image
              src={photoUrl}
              alt={review.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              priority={false}
            />
          </div>
        </Link>
      )}

      <div className="p-4 sm:p-6 space-y-4">
        {/* Restaurant and Rating */}
        <Link href={`/restaurants/${restaurant.id}`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg group-hover:text-amber-600 transition-colors truncate">
                {restaurant.name}
              </h3>
              <p className="text-sm text-gray-600">{restaurant.cuisine}</p>
            </div>
            <StarRating rating={review.rating} size={18} readonly />
          </div>
        </Link>

        {/* Review Title and Snippet */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 text-base">{review.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-3">
            {review.content}
          </p>
        </div>

        {/* Footer: Author, Date, and Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Link href={`/profile/${author.id}`} className="flex items-center gap-2 flex-1">
            {author.avatar_url && (
              <Image
                src={author.avatar_url}
                alt={author.display_name}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {author.display_name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {timeAgo}
              </p>
            </div>
          </Link>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 size={16} />
            </button>

            {isOwnReview && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="More options"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                    <Link
                      href={`/review/${review.id}/edit`}
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 first:rounded-t-lg transition-colors"
                    >
                      <Edit2 size={16} />
                      Edit Review
                    </Link>
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        handleDelete()
                      }}
                      disabled={isDeleting}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 last:rounded-b-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      {isDeleting ? 'Deleting...' : 'Delete Review'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
import { ReviewWithAuthor } from '@/lib/types';
import StarRating from './StarRating';

interface ReviewCardProps {
  review: ReviewWithAuthor;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const visitDate = review.visit_date
    ? new Date(review.visit_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="rounded-xl bg-neutral-900/50 border border-neutral-800/50 p-4 hover:border-neutral-700/50 transition-colors">
      {/* Author Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-neutral-950">
            {review.profiles?.avatar_url ? (
              <img
                src={review.profiles.avatar_url}
                alt={review.profiles.username || 'User'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(review.profiles?.username || 'Unknown')
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{review.profiles?.username ?? 'Unknown'}</p>
              {review.profiles?.is_critic && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 rounded-full">
                  CRITIC
                </span>
              )}
            </div>
            {visitDate && <p className="text-xs text-neutral-500">{visitDate}</p>}
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="mb-3">
        <StarRating rating={review.rating} size="sm" />
      </div>

      {/* Review Title & Content */}
      <h4 className="text-sm font-bold text-white mb-2">{review.title}</h4>
      <p className="text-sm text-neutral-400 line-clamp-3">{review.content}</p>
    </div>
  );
}
