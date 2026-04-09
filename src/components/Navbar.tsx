'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import RestaurantSearchDropdown from './RestaurantSearchDropdown'
import { Restaurant } from '@/types/database'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileOpen(false)
    router.push('/')
  }

  const handleSelectLocalRestaurant = (restaurant: Restaurant) => {
    router.push(`/restaurants/${restaurant.id}`)
  }

  const handleSelectGooglePlace = (place: any) => {
    router.push(
      `/review/new?name=${encodeURIComponent(place.name)}&city=${encodeURIComponent(place.city)}&address=${encodeURIComponent(place.address || '')}`
    )
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              G
            </div>
            <span className="font-bold text-gray-900 hidden sm:inline text-sm tracking-tight">
              Gastronome
            </span>
          </Link>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-sm">
            <RestaurantSearchDropdown
              onSelectLocal={handleSelectLocalRestaurant}
              onSelectGoogle={handleSelectGooglePlace}
              placeholder="Find a restaurant..."
              size="sm"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/restaurants"
              className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              Explore
            </Link>
            {user && (
              <Link
                href="/feed"
                className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                Feed
              </Link>
            )}

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-50 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={16} className="text-gray-500" />
                    </div>
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                    <Link
                      href={`/profile/${user.id}`}
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/profile/edit"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit Profile
                    </Link>
                    <Link
                      href="/review/new"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Write a Review
                    </Link>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="px-4 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile: just search on small screens, BottomNav handles navigation */}
          <div className="md:hidden flex-1 max-w-xs">
            <RestaurantSearchDropdown
              onSelectLocal={handleSelectLocalRestaurant}
              onSelectGoogle={handleSelectGooglePlace}
              placeholder="Search..."
              size="sm"
            />
          </div>
        </div>
      </div>
    </nav>
  )
}
