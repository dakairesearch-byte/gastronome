'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Loader2 } from 'lucide-react'
import CriticCard from '@/components/CriticCard'
import EmptyState from '@/components/EmptyState'
import { UserCheck } from 'lucide-react'

export default function FollowingPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [following, setFollowing] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        // Get main profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single()

        setProfile(profileData)

        // Get following
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', params.id)

        if (followsData && followsData.length > 0) {
          const followingIds = followsData.map((f) => f.following_id)

          const { data: followingProfiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', followingIds)

          if (followingProfiles) {
            // Fetch review counts for each profile
            const followingWithCounts = await Promise.all(
              followingProfiles.map(async (followingProfile) => {
                const { count: reviewCount } = await supabase
                  .from('reviews')
                  .select('*', { count: 'exact', head: true })
                  .eq('author_id', followingProfile.id)

                const { count: followerCount } = await supabase
                  .from('follows')
                  .select('*', { count: 'exact', head: true })
                  .eq('following_id', followingProfile.id)

                return {
                  profile: followingProfile,
                  reviewCount: reviewCount || 0,
                  followerCount: followerCount || 0,
                }
              })
            )

            setFollowing(
              followingWithCounts.map((f) => ({
                ...f.profile,
                _reviewCount: f.reviewCount,
                _followerCount: f.followerCount,
              }))
            )
          }
        }
      } catch (err) {
        console.error('Error fetching following:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFollowing()
  }, [params.id, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Profile not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href={`/profile/${params.id}`} className="text-amber-600 hover:text-amber-700 mb-4 inline-block font-medium">
            â Back to {profile.display_name}'s profile
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Following
          </h1>
          <p className="text-lg text-gray-600">
            {profile.display_name} is following {following.length} {following.length === 1 ? 'critic' : 'critics'}
          </p>
        </div>

        {following.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {following.map((followingProfile: any) => (
              <CriticCard
                key={followingProfile.id}
                profile={followingProfile}
                reviewCount={followingProfile._reviewCount}
                followerCount={followingProfile._followerCount}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UserCheck}
            title="Not following anyone yet"
            description={`${profile.display_name} hasn't followed any critics yet`}
          />
        )}
      </div>
    </div>
  )
}
