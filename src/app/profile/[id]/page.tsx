'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { MapPin, UtensilsCrossed } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

export default function ProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Viewing your own profile?  That lives at `/profile` now
        // (settings-only). Redirect so there's a single canonical
        // destination for your own profile and no duplicated UI.
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id === params.id) {
          router.replace('/profile')
          return
        }

        const { data: profileData } = await supabase
          .from('profiles').select('*').eq('id', params.id).single()

        if (profileData) setProfile(profileData)
      } finally {
        setLoading(false)
      }
    }
    fetchProfileData()
  }, [params.id, supabase, router])

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

        {/* Explore CTA */}
        <section>
          <EmptyState
            icon={UtensilsCrossed}
            title={`${profile.display_name} is on Gastronome`}
            description="Compare restaurant ratings from every major platform in one place"
            ctaText={undefined}
            ctaHref={undefined}
          />
        </section>
      </div>
    </div>
  )
}
