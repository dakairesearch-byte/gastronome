'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  User,
  LogOut,
  Menu,
  X,
  Home,
  Search,
  Rss,
  PenSquare,
  Settings,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import RestaurantSearchDropdown from './RestaurantSearchDropdown'
import { Restaurant } from '@/types/database'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

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
      if (!session?.user) {
        setProfile(null)
      }
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileOpen(false)
    setMobileMenuOpen(false)
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

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/restaurants', label: 'Explore', icon: Search },
    { href: '/feed', label: 'Feed', icon: Rss, requiresAuth: true },
    { href: '/review/new', label: 'Write a Review', icon: PenSquare, requiresAuth: true },
  ]

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm">
                G
              </div>
              <span className="font-bold text-gray-900 hidden sm:inline text-base tracking-tight">
                Gastronome
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks
                .filter((link) => !link.requiresAuth || user)
                .map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-xs">
              <RestaurantSearchDropdown
                onSelectLocal={handleSelectLocalRestaurant}
                onSelectGoogle={handleSelectGooglePlace}
                placeholder="Find a restaurant..."
                size="sm"
              />
            </div>

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-gray-100">
                        <User size={16} className="text-emerald-600" />
                      </div>
                    )}
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1 overflow-hidden">
                      {profile && (
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {profile.display_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            @{profile.username}
                          </p>
                        </div>
                      )}
                      <Link
                        href={`/profile/${user.id}`}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User size={15} className="text-gray-400" />
                        My Profile
                      </Link>
                      <Link
                        href="/profile/edit"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings size={15} className="text-gray-400" />
                        Settings
                      </Link>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/auth/login"
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium shadow-sm"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile: Search + Hamburger */}
            <div className="md:hidden flex items-center gap-2 flex-1 justify-end">
              <div className="flex-1 max-w-[200px]">
                <RestaurantSearchDropdown
                  onSelectLocal={handleSelectLocalRestaurant}
                  onSelectGoogle={handleSelectGooglePlace}
                  placeholder="Search..."
                  size="sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-0 right-0 w-72 h-full bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="font-bold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* User info */}
            {user && profile && (
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                      <User size={18} className="text-emerald-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {profile.display_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">@{profile.username}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nav Links */}
            <div className="py-2">
              {navLinks
                .filter((link) => !link.requiresAuth || user)
                .map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive(link.href)
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={18} className={isActive(link.href) ? 'text-emerald-600' : 'text-gray-400'} />
                      {link.label}
                    </Link>
                  )
                })}
            </div>

            {/* Profile / Auth links */}
            <div className="border-t border-gray-100 py-2">
              {user ? (
                <>
                  <Link
                    href={`/profile/${user.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={18} className="text-gray-400" />
                    My Profile
                  </Link>
                  <Link
                    href="/profile/edit"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={18} className="text-gray-400" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign out
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 space-y-2">
                  <Link
                    href="/auth/login"
                    className="block w-full text-center py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="block w-full text-center py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
