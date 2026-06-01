'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/components/navItems'

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

  // Tabs come from the shared NAV_ITEMS spine (Home, Explore, Search,
  // Saved, Community) so the bottom bar never drifts from the desktop
  // header. That fills the 5-tab budget exactly. Account/Profile is NOT
  // a bottom tab — it lives in the header drawer (mobile) and the
  // top-right account control (desktop), keeping the bar uncrowded.

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTop: '1px solid var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* min-height (not a fixed h-16) so the icon + 10px label always
          have vertical room — the "Home" label was clipping when the
          flex row was locked to 64px. The home-indicator inset is added
          by the outer <nav>'s paddingBottom, so it stacks on top of this
          rather than eating into the label space. */}
      <div className="flex items-center justify-around min-h-16 px-2">
        {NAV_ITEMS.map((tab) => {
          const active = isActivePath(pathname, tab.path)
          const Icon = tab.icon
          return (
            <Link
              key={tab.path}
              href={tab.path}
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
      </div>
    </nav>
  )
}
