'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Loader2, Users } from 'lucide-react'
import CriticCard from '@/components/CriticCard'
import EmptyState from '@/components/EmptyState'

export default function FollowersPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [followers, setFollowers] = useState<{ profile: Profile; reviewCount: number; followerCount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single()

        setProfile(profileData)

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

            setFollowers(followersWithCounts)
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
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-gray-500">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <Link href={`/profile/${params.id}`} className="text-amber-600 hover:text-amber-700 text-sm mb-3 inline-block font-medium">
            &larr; {profile.display_name}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Followers</h1>
          <p className="text-sm text-gray-400 mt-1">
            {followers.length} {followers.length === 1 ? 'person' : 'people'}
          </p>
        </div>

        {followers.length > 0 ? (
          <div className="space-y-3">
            {followers.map(({ profile: follower, reviewCount, followerCount }) => (
              <CriticCard
                key={follower.id}
                profile={follower}
                reviewCount={reviewCount}
                followerCount={followerCount}
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
