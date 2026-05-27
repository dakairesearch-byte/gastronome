'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Search, Users, User } from 'lucide-react'
import { useAuthUser } from '@/lib/hooks/useAuthUser'
import { openSignInModal } from '@/components/auth/SignInModalHost'

/**
 * Exact-prefix match: `/exploreXYZ` must NOT activate `/explore`. Match
 * either the exact path or an immediate child segment.
 */
function isActivePath(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}

export default function BottomNav() {
  const pathname = usePathname()
  const authed = !!useAuthUser()

  // Search was previously absent from the bottom nav — the primary verb
  // of the product on mobile had no reachable surface. Sweep v2 flagged
  // this as a P0. Added between Explore and Community so the most-used
  // discover-by-intent action is in thumb reach.
  const navTabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/explore', icon: Compass, label: 'Explore' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/community', icon: Users, label: 'Community' },
  ] as const

  const profileActive = isActivePath(pathname, '/profile')

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navTabs.map((tab) => {
          const active = isActivePath(pathname, tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className="relative z-10 flex flex-col items-center justify-center gap-0.5 flex-1 py-2"
              style={{
                color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span
                className="text-[10px]"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}

        {authed ? (
          <Link
            href="/profile"
            aria-current={profileActive ? 'page' : undefined}
            className="relative z-10 flex flex-col items-center justify-center gap-0.5 flex-1 py-2"
            style={{
              color: profileActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <User size={22} strokeWidth={profileActive ? 2.5 : 1.5} />
            <span
              className="text-[10px]"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: profileActive ? 500 : 400,
              }}
            >
              Profile
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openSignInModal()}
            className="relative z-10 flex flex-col items-center justify-center gap-0.5 flex-1 py-2"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Sign in"
          >
            <User size={22} strokeWidth={1.5} />
            <span
              className="text-[10px]"
              style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}
            >
              Sign in
            </span>
          </button>
        )}
      </div>
    </nav>
  )
}
