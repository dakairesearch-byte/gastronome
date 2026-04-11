'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReviewCard from '@/components/ReviewCard'
import CriticCard from '@/components/CriticCard'
import Link from 'next/link'
import { Users, UserPlus, Utensils, Rss, Star, ArrowRight } from 'lucide-react'

interface FeedReview {
  review: any
  restaurant: any
  author: any
  photos: any[]
}

export default function FeedPage() {
  const [feedReviews, setFeedReviews] = useState<FeedReview[]>([])
  const [suggestedCritics, setSuggestedCritics] = useState<{ profile: any; reviewCount: number; followerCount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [followingCount, setFollowingCount] = useState(0)

  useEffect(() => {
    async function loadFeed() {
      const supabase = createClient()
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        // Load suggested critics for logged-out state
        const { data: critics } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_critic', true)
          .limit(4)

        if (critics) {
          const criticsWithCounts = await Promise.all(
            critics.map(async (critic) => {
              const { count: reviewCount } = await supabase
                .from('reviews')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', critic.id)
              const { count: followerCount } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', critic.id)
              return { profile: critic, reviewCount: reviewCount || 0, followerCount: followerCount || 0 }
            })
          )
          setSuggestedCritics(criticsWithCounts)
        }
        setLoading(false)
        return
      }

      setUser(currentUser)

      const { data: following } = await supabase
        .from('follows').select('following_id').eq('follower_id', currentUser.id)

      if (!following || following.length === 0) {
        // Load suggested critics for the "follow someone" state
        const { data: critics } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_critic', true)
          .neq('id', currentUser.id)
          .limit(4)

        if (critics) {
          const criticsWithCounts = await Promise.all(
            critics.map(async (critic) => {
              const { count: reviewCount } = await supabase
                .from('reviews')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', critic.id)
              const { count: followerCount } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', critic.id)
              return { profile: critic, reviewCount: reviewCount || 0, followerCount: followerCount || 0 }
            })
          )
          setSuggestedCritics(criticsWithCounts)
        }

        setFollowingCount(0)
        setLoading(false)
        return
      }

      setFollowingCount(following.length)
      const followingIds = following.map((f) => f.following_id)

      const { data: reviews } = await supabase
        .from('reviews')
        .select('*, restaurants(*), profiles!reviews_author_id_fkey(*), review_photos(*)')
        .in('author_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!reviews || reviews.length === 0) { setLoading(false); return }

      const feedData = (reviews as any[])
        .filter((r) => r.restaurants && r.profiles)
        .map((r) => ({
          review: r,
          restaurant: r.restaurants,
          author: r.profiles,
          photos: r.review_photos || [],
        }))

      setFeedReviews(feedData)
      setLoading(false)
    }
    loadFeed()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-gray-100 rounded w-28" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Logged-out marketing state
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
            <Rss size={40} className="mx-auto mb-4 opacity-80" />
            <h1 className="text-2xl sm:text-3xl font-bold">Your personalized feed</h1>
            <p className="mt-3 text-emerald-100 max-w-md mx-auto">
              Follow food critics and enthusiasts to get a curated feed of restaurant reviews tailored to your taste.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/signup"
                className="px-6 py-2.5 bg-white text-emerald-700 rounded-lg font-semibold text-sm hover:bg-emerald-50 transition-colors"
              >
                Create an account
              </Link>
              <Link
                href="/auth/login"
                className="px-6 py-2.5 bg-emerald-700/40 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700/60 transition-colors border border-white/20"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Suggested Critics */}
        {suggestedCritics.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
            <div className="flex items-center gap-2 mb-4">
              <Star size={18} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900">Popular critics</h2>
            </div>
            <div className="space-y-3">
              {suggestedCritics.map(({ profile, reviewCount, followerCount }) => (
                <CriticCard
                  key={profile.id}
                  profile={profile}
                  reviewCount={reviewCount}
                  followerCount={followerCount}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Logged in but following nobody
  if (followingCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h1>

          <div className="text-center bg-white rounded-xl border border-gray-100 p-10 mb-8">
            <UserPlus size={36} className="mx-auto text-emerald-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Follow food critics</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              Start following other reviewers to see their latest reviews in your feed.
            </p>
            <Link
              href="/restaurants"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
            >
              Discover restaurants
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Suggested Critics */}
          {suggestedCritics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Suggested critics</h2>
              </div>
              <div className="space-y-3">
                {suggestedCritics.map(({ profile, reviewCount, followerCount }) => (
                  <CriticCard
                    key={profile.id}
                    profile={profile}
                    reviewCount={reviewCount}
                    followerCount={followerCount}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Logged in, following people, but no reviews
  if (feedReviews.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Feed</h1>
          <div className="text-center bg-white rounded-xl border border-gray-100 p-10">
            <Utensils size={36} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">No reviews yet</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              The people you follow haven&apos;t posted any reviews yet. Check back later!
            </p>
            <Link
              href="/restaurants"
              className="inline-block px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
            >
              Browse Restaurants
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Main feed with reviews
  return (
    <div className="min-h-screen bg-gray-50">
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
