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
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { setLoading(false); return }
      setUser(currentUser)

      const { data: following } = await supabase
        .from('follows').select('following_id').eq('follower_id', currentUser.id)

      if (!following || following.length === 0) {
        setFollowingCount(0); setLoading(false); return
      }

      setFollowingCount(following.length)
      const followingIds = following.map((f) => f.following_id)

      const { data: reviews } = await supabase
        .from('reviews').select('*').in('author_id', followingIds)
        .order('created_at', { ascending: false }).limit(20)

      if (!reviews || reviews.length === 0) { setLoading(false); return }

      const feedData = await Promise.all(
        reviews.map(async (review) => {
          const [restaurantRes, authorRes, photosRes] = await Promise.all([
            supabase.from('restaurants').select('*').eq('id', review.restaurant_id).single(),
            supabase.from('profiles').select('*').eq('id', review.author_id).single(),
            supabase.from('review_photos').select('*').eq('review_id', review.id),
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
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-100 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-gray-100 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-gray-100 rounded w-28" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-full" />
                  <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center bg-white rounded-lg border border-gray-100 p-10">
            <Users size={36} className="mx-auto text-gray-300 mb-3" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Your Feed</h1>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              Sign in to see reviews from people you follow.
            </p>
            <Link href="/auth/login" className="inline-block px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (followingCount === 0) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h1>
          <div className="text-center bg-white rounded-lg border border-gray-100 p-10">
            <UserPlus size={36} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Follow food lovers</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              Start following other reviewers to see their latest reviews in your feed.
            </p>
            <Link href="/restaurants" className="inline-block px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium">
              Discover
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (feedReviews.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h1>
          <div className="text-center bg-white rounded-lg border border-gray-100 p-10">
            <Utensils size={36} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">No reviews yet</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              The people you follow haven&apos;t posted any reviews yet.
            </p>
            <Link href="/restaurants" className="inline-block px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium">
              Browse Restaurants
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
          <p className="text-sm text-gray-400 mt-1">
            From {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
          </p>
        </div>

        <div className="space-y-4">
          {feedReviews.map(({ review, restaurant, author, photos }) => (
            <ReviewCard
              key={review.id}
              review={review}
              restaurant={restaurant}
              author={author}
              photos={photos}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
