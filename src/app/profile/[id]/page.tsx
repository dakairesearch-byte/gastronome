'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Edit2, MapPin, UtensilsCrossed } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

export default function ProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setIsOwnProfile(session?.user?.id === params.id)

        const { data: profileData } = await supabase
          .from('profiles').select('*').eq('id', params.id).single()

        if (profileData) setProfile(profileData)
      } finally {
        setLoading(false)
      }
    }
    fetchProfileData()
  }, [params.id, supabase])

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
          <Link href="/" className="text-sm text-emerald-600 hover:text-emerald-700">Go home</Link>
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
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
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
            {profile.home_city && (
              <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <MapPin size={13} />
                {profile.home_city}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {isOwnProfile && (
          <div>
            <Link
              href="/profile/edit"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Edit2 size={14} />
              Edit Profile
            </Link>
          </div>
        )}

        {/* Explore CTA */}
        <section>
          <EmptyState
            icon={UtensilsCrossed}
            title={isOwnProfile ? 'Start exploring' : `${profile.display_name} is on Gastronome`}
            description={isOwnProfile ? 'Discover and compare restaurant ratings across Google, Yelp, and more' : 'Compare restaurant ratings from every major platform in one place'}
            ctaText={isOwnProfile ? 'Browse restaurants' : undefined}
            ctaHref={isOwnProfile ? '/restaurants' : undefined}
          />
        </section>
      </div>
    </div>
  )
}
