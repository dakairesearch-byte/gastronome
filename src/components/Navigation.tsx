'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Menu, X, LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/explore', label: 'Explore' },
  { path: '/community', label: 'Community' },
  { path: '/profile', label: 'Profile' },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Auth session
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
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
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
    })
    return () => subscription?.unsubscribe()
  }, [supabase])

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change (React-safe derived-state pattern)
  const [tracked, setTracked] = useState(pathname)
  if (tracked !== pathname) {
    setTracked(pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileOpen(false)
    setMobileOpen(false)
    router.push('/')
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-sm flex items-center justify-center text-white font-bold text-lg shadow-sm"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                G
              </div>
              <h1
                className="text-2xl hidden sm:block"
                style={{
                  fontFamily: "'Spectral', serif",
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text)',
                }}
              >
                Gastronome
              </h1>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="relative group"
                    style={{
                      color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      className="text-xs tracking-widest uppercase"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: '0.12em',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {item.label}
                    </span>
                    {active && (
                      <div
                        className="absolute -bottom-6 left-0 right-0 h-px"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Right side: search + avatar */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/search"
                className="p-2 rounded-sm transition-colors hover:bg-gray-100"
              >
                <Search size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </Link>
              {user ? (
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 rounded-sm hover:bg-gray-100 transition-colors"
                  >
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-sm object-cover"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-sm flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      >
                        {(profile?.display_name ?? 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                  {profileOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 rounded-sm shadow-lg border z-50 py-1 overflow-hidden"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      {profile && (
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <p className="text-sm font-medium truncate" style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}>
                            {profile.display_name}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                            @{profile.username}
                          </p>
                        </div>
                      )}
                      <Link
                        href={`/profile/${user.id}`}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                        style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/profile/edit"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                        style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}
                      >
                        <Settings size={15} style={{ color: 'var(--color-text-secondary)' }} />
                        Settings
                      </Link>
                      <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/auth/login"
                    className="text-xs uppercase tracking-wider font-medium transition-colors"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: '0.1em',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-5 py-2 text-xs uppercase tracking-wider font-medium rounded-sm transition-all hover:opacity-90 text-white"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: '0.1em',
                      backgroundColor: 'var(--color-primary)',
                    }}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-sm transition-colors hover:bg-gray-100"
            >
              {mobileOpen ? (
                <X size={22} style={{ color: 'var(--color-text)' }} />
              ) : (
                <Menu size={22} style={{ color: 'var(--color-text)' }} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-0 right-0 w-72 h-full shadow-2xl"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}>
                Menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-sm hover:bg-gray-100"
              >
                <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>

            <div className="py-2">
              {navItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex items-center px-5 py-3.5 text-xs uppercase tracking-wider transition-colors"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: '0.12em',
                      fontWeight: active ? 500 : 400,
                      color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      backgroundColor: active ? 'rgba(107,149,168,0.08)' : 'transparent',
                      borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)' }} className="py-3 px-5 space-y-2">
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 text-xs uppercase tracking-wider font-medium text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.1em' }}
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="block w-full text-center py-2.5 border rounded-sm text-xs uppercase tracking-wider font-medium transition-colors"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: '0.1em',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="block w-full text-center py-2.5 rounded-sm text-xs uppercase tracking-wider font-medium text-white transition-all hover:opacity-90"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: '0.1em',
                      backgroundColor: 'var(--color-primary)',
                    }}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
