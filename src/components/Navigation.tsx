'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, User, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/explore', label: 'Explore' },
  { path: '/community', label: 'Community' },
  { path: '/profile', label: 'Profile' },
]

/**
 * Exact-prefix match: `/exploreXYZ` must NOT activate `/explore`. We
 * match either the exact path or an immediate child segment.
 */
function isActivePath(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)

  // Lightweight auth check so the right-side icon links to /profile for
  // signed-in users or /auth/login for everyone else. No profile
  // dropdown; the Figma design keeps the header minimal.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Close mobile menu on route change (React-safe derived-state pattern)
  const [tracked, setTracked] = useState(pathname)
  if (tracked !== pathname) {
    setTracked(pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
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
          <div className="flex items-center justify-between h-28">
            {/* Logo */}
            <Link href="/" className="flex items-center" aria-label="Gastronome">
              <Image
                src="/Logo.jpg"
                alt="Gastronome"
                width={96}
                height={96}
                priority
                className="h-24 w-24 object-contain"
              />
            </Link>

            {/* Desktop nav — centered cluster */}
            <nav className="hidden md:flex items-center gap-10">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="relative group py-2"
                    style={{
                      color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      className="text-xs uppercase"
                      style={{
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.16em',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {item.label}
                    </span>
                    {active && (
                      <div
                        className="absolute -bottom-1 left-0 right-0 h-px"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Minimal profile/sign-in affordance — the Figma design
                doesn't show an avatar cluster, but users still need a
                reachable entry point for auth. */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <Link
                  href="/profile"
                  aria-label="Profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-sm transition-colors hover:bg-gray-100"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <User size={18} strokeWidth={1.5} />
                  <span
                    className="text-xs uppercase"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.16em' }}
                  >
                    Profile
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openSignInModal({ mode: 'signin' })}
                  className="flex items-center gap-2 px-3 py-2 rounded-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <User size={18} strokeWidth={1.5} />
                  <span
                    className="text-xs uppercase"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.16em' }}
                  >
                    Sign in
                  </span>
                </button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-sm transition-colors hover:bg-gray-100"
              aria-label="Toggle menu"
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
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-0 right-0 w-72 h-full shadow-2xl"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-5"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <span
                className="text-sm font-medium"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-sm hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>

            <div className="py-2">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex items-center px-5 py-3.5 text-xs uppercase transition-colors"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.16em',
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
                <>
                  <Link
                    href="/profile"
                    className="block w-full text-center py-2.5 border rounded-sm text-xs uppercase tracking-wider font-medium transition-colors"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full py-2.5 text-xs uppercase tracking-wider font-medium text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.1em' }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      openSignInModal({ mode: 'signin' })
                    }}
                    className="block w-full text-center py-2.5 border rounded-sm text-xs uppercase tracking-wider font-medium transition-colors"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      openSignInModal({ mode: 'signup' })
                    }}
                    className="block w-full text-center py-2.5 rounded-sm text-xs uppercase tracking-wider font-medium text-white transition-all hover:opacity-90"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      backgroundColor: 'var(--color-primary)',
                    }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
