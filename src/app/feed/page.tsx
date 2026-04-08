'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReviewCard from '@/components/ReviewCard'
import Link from 'next/link'
import { Users, UserPlus, Utensils } from 'lucide-react'

interface FeedReview {
  review: any
  restaurant: any
  author: any
  photos: any[]
}

export default function FeedPage() {
  const [feedReviews, setFeedReviews] = useState<FeedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [followingCount, setFollowingCount] = useState(0)

  useEffect(() => {
    async function loadFeed() {
      const supabase = createClient()

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        setLoading(false)
        return
      }
      setUser(currentUser)

      // Get list of users this person follows
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)

      if (!following || following.length === 0) {
        setFollowingCount(0)
        setLoading(false)
        return
      }

      setFollowingCount(following.length)
      const followingIds = following.map((f) => f.following_id)

      // Fetch recent reviews from followed users
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .in('author_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!reviews || reviews.length === 0) {
        setLoading(false)
        return
      }

      // Fetch restaurant, author, and photos for each review
      const feedData = await Promise.all(
        reviews.map(async (review) => {
          const [restaurantRes, authorRes, photosRes] = await Promise.all([
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
            restaurant: restaurantRes.data,
            author: authorRes.data,
            photos: photosRes.data || [],
          }
        })
      )

      setFeedReviews(feedData.filter((item) => item.restaurant && item.author))
      setLoading(false)
    }

    loadFeed()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-12">
            <Users size={48} className="mx-auto text-emerald-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Your Feed</h1>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Sign in to see reviews from people you follow and discover new restaurants through their experiences.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Not following anyone
  if (followingCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Feed</h1>
          <div className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-12">
            <UserPlus size={48} className="mx-auto text-emerald-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Follow food lovers</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start following other reviewers to see their latest restaurant reviews and recommendations in your feed.
            </p>
            <Link
              href="/search"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm"
            >
              Discover Reviewers
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Has following but no reviews
  if (feedReviews.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Feed</h1>
          <div className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-12">
            <Utensils size={48} className="mx-auto text-emerald-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No reviews yet</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              The people you follow haven&apos;t posted any reviews yet. Check back soon or explore restaurants on your own!
            </p>
            <Link
              href="/restaurants"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm"
            >
              Browse Restaurants
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Feed</h1>
            <p className="text-gray-500 mt-1">
              Latest reviews from {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
            </p>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-6">
          {feedReviews.map(({ review, restaurant, author, photos }) => (
            <div key={review.id} className="relative">
              {/* Author attribution line */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <Link
                  href={`/profile/${author.id}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {author.avatar_url ? (
                    <img
                      src={author.avatar_url}
                      alt={author.display_name || author.username}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-emerald-700">
                        {(author.display_name || author.username || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">
                    {author.display_name || author.username}
                  </span>
                </Link>
                <span className="text-sm text-gray-400">reviewed</span>
                <Link
                  href={`/restaurants/${restaurant.id}`}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  {restaurant.name}
                </Link>
              </div>

              <ReviewCard
                review={review}
                restaurant={restaurant}
                author={author}
                photos={photos}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
