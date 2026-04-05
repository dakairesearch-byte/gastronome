'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Loader2 } from 'lucide-react'
import CriticCard from '@/components/CriticCard'
import EmptyState from '@/components/EmptyState'
import { Users } from 'lucide-react'

export default function FollowersPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [followers, setFollowers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        // Get main profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single()

        setProfile(profileData)

        // Get followers
        const { data: followsData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', params.id)

        if (followsData && followsData.length > 0) {
          const followerIds = followsData.map((f) => f.follower_id)

          const { data: followerProfiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', followerIds)

          if (followerProfiles) {
            // Fetch review counts for each follower
            const followersWithCounts = await Promise.all(
              followerProfiles.map(async (follower) => {
                const { count: reviewCount } = await supabase
                  .from('reviews')
                  .select('*', { count: 'exact', head: true })
                  .eq('author_id', follower.id)

                const { count: followerCount } = await supabase
                  .from('follows')
                  .select('*', { count: 'exact', head: true })
                  .eq('following_id', follower.id)

                return {
                  profile: follower,
                  reviewCount: reviewCount || 0,
                  followerCount: followerCount || 0,
                }
              })
            )

            setFollowers(
              followersWithCounts.map((f) => ({
                ...f.profile,
                _reviewCount: f.reviewCount,
                _followerCount: f.followerCount,
              }))
            )
          }
        }
      } catch (err) {
        console.error('Error fetching followers:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFollowers()
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
            Followers
          </h1>
          <p className="text-lg text-gray-600">
            {followers.length} {followers.length === 1 ? 'person' : 'people'} following {profile.display_name}
          </p>
        </div>

        {followers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {followers.map((follower: any) => (
              <CriticCard
                key={follower.id}
                profile={follower}
                reviewCount={follower._reviewCount}
                followerCount={follower._followerCount}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No followers yet"
            description={`${profile.display_name} doesn't have any followers yet`}
          />
        )}
      </div>
    </div>
  )
}
