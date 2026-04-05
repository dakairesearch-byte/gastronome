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

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/restaurants"
              className="text-gray-700 hover:text-amber-600 transition-colors font-medium text-sm"
            >
              Restaurants
            </Link>

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
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                    <Link
                      href={`/profile/${user.id}`}
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 first:rounded-t-lg"
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
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 last:rounded-b-lg"
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
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-sm"
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
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <span className="text-xl font-bold tracking-widest text-amber-500 group-hover:text-amber-400 transition-colors">
              GASTRONOME
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/discover"
              className="text-neutral-300 hover:text-amber-500 transition-colors text-sm font-medium"
            >
              Discover
            </Link>
            <Link
              href="/top-rated"
              className="text-neutral-300 hover:text-amber-500 transition-colors text-sm font-medium"
            >
              Top Rated
            </Link>
          </div>

          {/* Search Bar */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search restaurants..."
                className="w-full px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {!loading && !user ? (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-neutral-300 hover:text-amber-500 transition-colors text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-full transition-colors text-sm font-medium"
                >
                  Sign Up
                </Link>
              </>
            ) : !loading ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-neutral-950">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-neutral-300 hover:text-red-400 transition-colors text-sm font-medium"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-neutral-300 hover:text-amber-500 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-neutral-800/50">
            <div className="flex flex-col gap-3 mt-4">
              <Link
                href="/discover"
                className="text-neutral-300 hover:text-amber-500 transition-colors text-sm font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Discover
              </Link>
              <Link
                href="/top-rated"
                className="text-neutral-300 hover:text-amber-500 transition-colors text-sm font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Top Rated
              </Link>
              {!loading && !user ? (
                <>
                  <Link
                    href="/auth/login"
                    className="text-neutral-300 hover:text-amber-500 transition-colors text-sm font-medium py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-full transition-colors text-sm font-medium text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              ) : !loading ? (
                <button
                  onClick={handleSignOut}
                  className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium py-2 text-left"
                >
                  Sign Out
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
