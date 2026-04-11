'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Loader2, UserCheck } from 'lucide-react'
import UserCard from '@/components/UserCard'
import EmptyState from '@/components/EmptyState'

export default function FollowingPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [following, setFollowing] = useState<{ profile: Profile; followerCount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single()

        setProfile(profileData)

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
            const followingWithCounts = await Promise.all(
              followingProfiles.map(async (followingProfile) => {
                const { count: followerCount } = await supabase
                  .from('follows')
                  .select('*', { count: 'exact', head: true })
                  .eq('following_id', followingProfile.id)

                return {
                  profile: followingProfile,
                  followerCount: followerCount || 0,
                }
              })
            )

            setFollowing(followingWithCounts)
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
        <Loader2 className="animate-spin text-emerald-500" size={24} />
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
          <Link href={`/profile/${params.id}`} className="text-emerald-600 hover:text-emerald-700 text-sm mb-3 inline-block font-medium">
            &larr; {profile.display_name}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Following</h1>
          <p className="text-sm text-gray-400 mt-1">
            {following.length} {following.length === 1 ? 'user' : 'users'}
          </p>
        </div>

        {following.length > 0 ? (
          <div className="space-y-3">
            {following.map(({ profile: followingProfile, followerCount }) => (
              <UserCard
                key={followingProfile.id}
                profile={followingProfile}
                followerCount={followerCount}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UserCheck}
            title="Not following anyone yet"
            description={`${profile.display_name} hasn't followed anyone yet`}
          />
        )}
      </div>
    </div>
  )
}
