'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut, Menu, X, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import RestaurantSearchDropdown from './RestaurantSearchDropdown'
import { Restaurant } from '@/types/database'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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
    setMenuOpen(false)
    router.push('/')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
      setMenuOpen(false)
    }
  }

  const handleSelectLocalRestaurant = (restaurant: Restaurant) => {
    router.push(`/restaurants/${restaurant.id}`)
  }

  const handleSelectGooglePlace = (
    place: any
  ) => {
    router.push(
      `/review/new?name=${encodeURIComponent(place.name)}&city=${encodeURIComponent(place.city)}&address=${encodeURIComponent(place.address || '')}`
    )
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-amber-100/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
              G
            </div>
            <span className="font-bold text-gray-900 hidden sm:inline text-sm sm:text-base tracking-tight">
              Gastronome
            </span>
          </Link>

          {/* Desktop Search */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <RestaurantSearchDropdown
              onSelectLocal={handleSelectLocalRestaurant}
              onSelectGoogle={handleSelectGooglePlace}
              placeholder="Find a restaurant..."
              size="sm"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/restaurants"
              className="text-gray-700 hover:text-amber-600 transition-colors font-medium text-sm"
            >
              Restaurants
            </Link>
            {user && (
              <Link
                href="/feed"
                className="text-gray-700 hover:text-amber-600 transition-colors font-medium text-sm"
              >
                Feed
              </Link>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <User size={20} className="text-gray-600" />
                  )}
                  <span className="text-sm font-medium text-gray-700 truncate max-w-[100px]">
                    {profile?.display_name}
                  </span>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-100/80 z-50">
                    <Link
                      href={`/profile/${user.id}`}
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 first:rounded-t-xl"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/profile/edit"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50"
                    >
                      Edit Profile
                    </Link>
                    <Link
                      href="/review/new"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50"
                    >
                      Write a Review
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 last:rounded-b-xl"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium text-sm shadow-sm"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 hover:bg-amber-50 rounded-lg transition-colors"
          >
            {menuOpen ? (
              <X size={24} className="text-gray-700" />
            ) : (
              <Menu size={24} className="text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-amber-100 mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="px-4">
              <RestaurantSearchDropdown
                onSelectLocal={handleSelectLocalRestaurant}
                onSelectGoogle={handleSelectGooglePlace}
                placeholder="Find a restaurant..."
                size="sm"
              />
            </div>

            <Link
              href="/restaurants"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded transition-colors"
            >
              Restaurants
            </Link>

            {user ? (
              <>
                <Link
                  href={`/profile/${user.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded transition-colors"
                >
                  My Profile
                </Link>
                <Link
                  href="/profile/edit"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded transition-colors"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/review/new"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-amber-50 rounded transition-colors"
                >
                  Write a Review
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-center font-medium shadow-sm"
              >
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
