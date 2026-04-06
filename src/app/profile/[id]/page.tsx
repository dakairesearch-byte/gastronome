'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ReviewCard from '@/components/ReviewCard'
import { Profile, Review, Restaurant, ReviewPhoto } from '@/types/database'
import { Users, UserCheck, Mail, Edit2 } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'reviews' | 'followers' | 'following'>('reviews')
  const supabase = createClient()

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setCurrentUser(session?.user ?? null)
        setIsOwnProfile(session?.user?.id === params.id)

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single()

        if (profileData) {
          setProfile(profileData)
        }

        // Fetch reviews
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*')
          .eq('author_id', params.id)
          .order('created_at', { ascending: false })

        if (reviewsData && profileData) {
          const reviewsWithData = await Promise.all(
            reviewsData.map(async (review) => {
              const [restaurant, photos] = await Promise.all([
                supabase
                  .from('restaurants')
                  .select('*')
                  .eq('id', review.restaurant_id)
                  .single(),
                supabase
                  .from('review_photos')
                  .select('*')
                  .eq('review_id', review.id),
              ])

              return {
                review,
                restaurant: restaurant.data,
                author: profileData,
                photos: photos.data || [],
              }
            })
          )

          setReviews(
            reviewsWithData.filter(
              (item): item is ReviewWithData => item.restaurant !== null
            )
          )
        }

        // Fetch follower/following counts
        const { count: followerCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', params.id)

        const { count: followingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', params.id)

        setFollowers(followerCount || 0)
        setFollowing(followingCount || 0)

        // Check if current user follows this profile
        if (session?.user?.id && session.user.id !== params.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', session.user.id)
            .eq('following_id', params.id)
            .single()

          setIsFollowing(!!followData)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [params.id, supabase])

  const toggleFollow = async () => {
    if (!currentUser || isOwnProfile) return

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', params.id)

        setFollowers(Math.max(0, followers - 1))
      } else {
        await supabase.from('follows').insert([
          {
            follower_id: currentUser.id,
            following_id: params.id,
          },
        ])

        setFollowers(followers + 1)
      }

      setIsFollowing(!isFollowing)
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile not found</h2>
          <p className="text-gray-600 mb-4">The profile you're looking for doesn't exist.</p>
          <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 py-8 sm:py-12 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Avatar and Basic Info */}
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-6 sm:gap-8">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-4xl font-bold flex-shrink-0 border-4 border-white shadow-lg">
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                      {profile.display_name}
                    </h1>
                    <p className="text-lg text-gray-600">@{profile.username}</p>
                  </div>
                  {profile.is_critic && (
                    <span className="inline-block px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-full">
                      CRITIC
                    </span>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-gray-700 mb-6">{profile.bio}</p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-6">
                  <div className="text-center sm:text-left">
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {reviews.length}
                    </p>
                    <p className="text-sm text-gray-600">
                      {reviews.length === 1 ? 'Review' : 'Reviews'}
                    </p>
                  </div>
                  <Link
                    href={`/profile/${params.id}/followers`}
                    className="text-center sm:text-left hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {followers}
                    </p>
                    <p className="text-sm text-gray-600">Followers</p>
                  </Link>
                  <Link
                    href={`/profile/${params.id}/following`}
                    className="text-center sm:text-left hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {following}
                    </p>
                    <p className="text-sm text-gray-600">Following</p>
                  </Link>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-1 space-y-3">
              {isOwnProfile ? (
                <>
                  <Link
                    href="/profile/edit"
                    className="w-full py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-semibold text-center flex items-center justify-center gap-2"
                  >
                    <Edit2 size={18} />
                    Edit Profile
                  </Link>
                  <Link
                    href="/review/new"
                    className="w-full py-3 border-2 border-emerald-500 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors font-semibold text-center"
                  >
                    Write Review
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleFollow}
                    className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                      isFollowing
                        ? 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>

                  {profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="w-full py-3 border-2 border-emerald-500 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors font-semibold text-center flex items-center justify-center gap-2"
                    >
                      <Mail size={18} />
                      Contact
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="border-b border-gray-200 sticky top-16 bg-white z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                activeTab === 'reviews'
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              Reviews ({reviews.length})
            </button>
            {!isOwnProfile && (
              <>
                <button
                  onClick={() => setActiveTab('followers')}
                  className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                    activeTab === 'followers'
                      ? 'text-emerald-600 border-emerald-600'
                      : 'text-gray-600 border-transparent hover:text-gray-900'
                  }`}
                >
                  Followers ({followers})
                </button>
                <button
                  onClick={() => setActiveTab('following')}
                  className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                    activeTab === 'following'
                      ? 'text-emerald-600 border-emerald-600'
                      : 'text-gray-600 border-transparent hover:text-gray-900'
                  }`}
                >
                  Following ({following})
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {reviews.length > 0 ? (
              reviews.map(({ review, restaurant, author, photos }) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  restaurant={restaurant}
                  author={author}
                  photos={photos}
                  isOwnReview={isOwnProfile}
                  onDelete={() => {
                    setReviews(reviews.filter((r) => r.review.id !== review.id))
                  }}
                />
              ))
            ) : (
              <EmptyState
                icon={Users}
                title={isOwnProfile ? "No reviews yet" : "No reviews"}
                description={
                  isOwnProfile
                    ? "Start sharing your dining experiences"
                    : "This user hasn't written any reviews yet"
                }
                ctaText={isOwnProfile ? "Write your first review" : undefined}
                ctaHref={isOwnProfile ? "/review/new" : undefined}
              />
            )}
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="text-center py-12">
            <p className="text-gray-600">
              View followers on a dedicated page
            </p>
            <Link
              href={`/profile/${params.id}/followers`}
              className="mt-4 inline-block text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Go to followers â
            </Link>
          </div>
        )}

        {activeTab === 'following' && (
          <div className="text-center py-12">
            <p className="text-gray-600">
              View following on a dedicated page
            </p>
            <Link
              href={`/profile/${params.id}/following`}
              className="mt-4 inline-block text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Go to following â
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
