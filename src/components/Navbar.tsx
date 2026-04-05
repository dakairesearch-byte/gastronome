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
    <nav className="sticky top-0 z-40 bg-white border-b border-amber-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-lg group-hover:shadow-md transition-shadow">
              G
            </div>
            <span className="font-semibold text-gray-900 hidden sm:inline text-sm sm:text-base">
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

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/discover" className="text-sm text-gray-600 hover:text-amber-600 transition-colors">
              Discover
            </Link>
            <Link href="/top-rated" className="text-sm text-gray-600 hover:text-amber-600 transition-colors">
              Top Rated
            </Link>
          </div>

          {/* Desktop Right */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/review/new"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Write Review
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <User size={18} />
                    <span className="hidden sm:inline text-sm">{profile?.display_name || 'Profile'}</span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <Link
                        href={`/profile/${user.id}`}
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 rounded-t-lg transition-colors"
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/my-reviews"
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 transition-colors"
                      >
                        My Reviews
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="sm:hidden py-4 space-y-3 border-t border-gray-200">
            <div className="px-2">
              <RestaurantSearchDropdown
                onSelectLocal={handleSelectLocalRestaurant}
                onSelectGoogle={handleSelectGooglePlace}
                placeholder="Find a restaurant..."
                size="sm"
              />
            </div>

            <Link
              href="/discover"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              Discover
            </Link>
            <Link
              href="/top-rated"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              Top Rated
            </Link>

            {user ? (
              <>
                <Link
                  href="/review/new"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors font-medium"
                >
                  Write Review
                </Link>
                <Link
                  href={`/profile/${user.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  My Profile
                </Link>
                <Link
                  href="/my-reviews"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  My Reviews
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
                className="block px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors text-center font-medium"
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
