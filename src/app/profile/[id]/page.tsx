'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReviewCard from '@/components/ReviewCard'
import { Profile, Review, Restaurant, ReviewPhoto } from '@/types/database'
import { Users, Edit2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

interface ReviewWithData {
  review: Review
  restaurant: Restaurant
  author: Profile
  photos: ReviewPhoto[]
}

export default function ProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<ReviewWithData[]>([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setCurrentUser(session?.user ?? null)
        setIsOwnProfile(session?.user?.id === params.id)

        const { data: profileData } = await supabase
          .from('profiles').select('*').eq('id', params.id).single()

        if (profileData) setProfile(profileData)

        const { data: reviewsData } = await supabase
          .from('reviews').select('*').eq('author_id', params.id)
          .order('created_at', { ascending: false })

        if (reviewsData && profileData) {
          const reviewsWithData = await Promise.all(
            reviewsData.map(async (review) => {
              const [restaurant, photos] = await Promise.all([
                supabase.from('restaurants').select('*').eq('id', review.restaurant_id).single(),
                supabase.from('review_photos').select('*').eq('review_id', review.id),
              ])
              return { review, restaurant: restaurant.data, author: profileData, photos: photos.data || [] }
            })
          )
          setReviews(reviewsWithData.filter((item): item is ReviewWithData => item.restaurant !== null))
        }

        const { count: followerCount } = await supabase
          .from('follows').select('*', { count: 'exact', head: true }).eq('following_id', params.id)
        const { count: followingCount } = await supabase
          .from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', params.id)

        setFollowers(followerCount || 0)
        setFollowing(followingCount || 0)

        if (session?.user?.id && session.user.id !== params.id) {
          const { data: followData } = await supabase
            .from('follows').select('*')
            .eq('follower_id', session.user.id).eq('following_id', params.id).single()
          setIsFollowing(!!followData)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProfileData()
  }, [params.id, supabase])

  const toggleFollow = async () => {
    if (isOwnProfile) return
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', currentUser.id).eq('following_id', params.id)
        setFollowers(Math.max(0, followers - 1))
      } else {
        await supabase.from('follows').insert([{ follower_id: currentUser.id, following_id: params.id }])
        setFollowers(followers + 1)
      }
      setIsFollowing(!isFollowing)
    } catch (error) {
      console.error('Error toggling follow:', error)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Profile not found</h2>
          <Link href="/" className="text-sm text-amber-600 hover:text-amber-700">Go home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">

        {/* Profile Header */}
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              {profile.display_name}
            </h1>
            <p className="text-sm text-gray-400">@{profile.username}</p>
            {profile.bio && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{profile.bio}</p>
            )}

            {/* Stats Row */}
            <div className="flex gap-5 mt-3">
              <div>
                <span className="text-sm font-bold text-gray-900">{reviews.length}</span>
                <span className="text-xs text-gray-400 ml-1">reviews</span>
              </div>
              <Link href={`/profile/${params.id}/followers`} className="hover:text-amber-600 transition-colors">
                <span className="text-sm font-bold text-gray-900">{followers}</span>
                <span className="text-xs text-gray-400 ml-1">followers</span>
              </Link>
              <Link href={`/profile/${params.id}/following`} className="hover:text-amber-600 transition-colors">
                <span className="text-sm font-bold text-gray-900">{following}</span>
                <span className="text-xs text-gray-400 ml-1">following</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isOwnProfile ? (
            <>
              <Link
                href="/profile/edit"
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-center flex items-center justify-center gap-1.5"
              >
                <Edit2 size={14} />
                Edit Profile
              </Link>
              <Link
                href="/review/new"
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium text-center"
              >
                Write Review
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleFollow}
              disabled={followLoading}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                isFollowing
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Reviews */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Reviews</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(({ review, restaurant, author, photos }) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  restaurant={restaurant}
                  author={author}
                  photos={photos}
                  isOwnReview={isOwnProfile}
                  onDelete={() => setReviews(reviews.filter((r) => r.review.id !== review.id))}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={isOwnProfile ? 'No reviews yet' : 'No reviews'}
              description={isOwnProfile ? 'Start sharing your dining experiences' : "This user hasn't written any reviews yet"}
              ctaText={isOwnProfile ? 'Write your first review' : undefined}
              ctaHref={isOwnProfile ? '/review/new' : undefined}
            />
          )}
        </section>
      </div>
    </div>
  )
}
