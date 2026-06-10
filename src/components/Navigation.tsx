'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, MapPin, Menu, User, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthUser } from '@/lib/hooks/useAuthUser'
import { useCity } from '@/lib/hooks/useCity'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import { NAV_ITEMS } from '@/components/navItems'

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
  const user = useAuthUser()
  const drawerRef = useRef<HTMLDivElement | null>(null)

  // Global city switcher (W0). The hook resolves the active city from the
  // URL ?city= param, then a sticky localStorage preference, then a
  // default; `setCity` persists and routes to the canonical browse surface.
  const { city, cities, setCity } = useCity()
  const [cityMenuOpen, setCityMenuOpen] = useState(false)
  const cityMenuRef = useRef<HTMLDivElement | null>(null)

  // Close the desktop city dropdown on outside-click / Escape.
  useEffect(() => {
    if (!cityMenuOpen) return
    function onPointer(e: MouseEvent) {
      if (cityMenuRef.current && !cityMenuRef.current.contains(e.target as Node)) {
        setCityMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCityMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [cityMenuOpen])

  // The dropdown should always include the active city even if the DB list
  // hasn't loaded or omits a custom URL city, so the current selection reads.
  const cityOptions = cities.includes(city) ? cities : [city, ...cities]

  const selectCity = (next: string) => {
    setCityMenuOpen(false)
    setMobileOpen(false)
    setCity(next)
  }

  // NV7 account control: derive a display avatar / initial from the
  // Supabase user. Falls back to the first email character, then a
  // neutral bullet so the circle never renders empty.
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const avatarUrl =
    typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined
  const displayName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    user?.email ||
    ''
  const accountInitial = displayName.trim().charAt(0).toUpperCase() || '•'

  // Close mobile menu on route change (React-safe derived-state pattern)
  const [tracked, setTracked] = useState(pathname)
  if (tracked !== pathname) {
    setTracked(pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  // Drawer a11y (TA3): Escape to close + a focus trap so Tab can't escape
  // into the blurred background page (WCAG 2.1.2). Mirrors the trapFocus
  // pattern used in SignInModal.tsx.
  useEffect(() => {
    if (!mobileOpen) return

    // Scroll-lock: the drawer is a fixed overlay, so without this the
    // page behind it keeps scrolling (and on iOS the drawer itself can
    // rubber-band). Mirrors SignInModal's lock/restore pattern.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const root = drawerRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
      else trapFocus(e)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
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
          // Keep the header clear of the notch / Dynamic Island in iOS
          // standalone mode (viewport-fit: cover is set on layout). This
          // sits on top of the inner row's existing h-16/h-20 height.
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div
          className="max-w-7xl mx-auto px-6 lg:px-8"
          style={{
            // Honor the side insets in landscape standalone so the logo
            // and hamburger aren't tucked under the rounded corners.
            paddingLeft: 'max(1.5rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1.5rem, env(safe-area-inset-right, 0px))',
          }}
        >
          {/* Header height was h-28 (112px) — burned ~13% of mobile
              viewport before any content. Shrunk to h-16 on mobile, h-20
              on desktop. Logo scales accordingly. */}
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo — `aria-label` names the destination ("Home") instead
                of repeating the brand, which is already in the wordmark.
                Image alt is empty to avoid double-announcement. */}
            <Link href="/" className="flex items-center" aria-label="Gastronome home">
              <Image
                src="/Logo.jpg"
                alt=""
                width={96}
                height={96}
                priority
                className="h-12 w-12 md:h-16 md:w-16 object-contain"
              />
            </Link>

            {/* Desktop nav — centered cluster.
                `aria-current="page"` is set on the active link so screen
                readers announce location; tracking widened from 0.16em
                to 0.12em so 12px text is recognisable at peripheral
                glance distance. Active underline thickened from 1px to
                2px for non-color signal. */}
            <nav className="hidden md:flex items-center gap-10" aria-label="Primary">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    aria-current={active ? 'page' : undefined}
                    className="relative group py-2"
                    style={{
                      color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      className="text-xs uppercase"
                      style={{
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.12em',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {item.label}
                    </span>
                    {active && (
                      <div
                        className="absolute -bottom-1 left-0 right-0 h-0.5"
                        style={{ backgroundColor: 'var(--color-action)' }}
                      />
                    )}
                  </Link>
                )
              })}
              {/* NV7: Profile is no longer a primary-cluster link. With
                  Saved now in NAV_ITEMS the centered row is full, so the
                  account entry point lives in the top-right control below
                  (auth-gated avatar / Sign in). */}
            </nav>

            {/* NV7 — top-right account control. Signed-in users get a
                compact avatar/initial that links to /profile (the account
                destination, moved out of the primary row); anonymous users
                get a Sign in affordance. `aria-current` marks the avatar
                when on a /profile route so the active location still reads
                to AT even though Profile left the primary cluster. */}
            <div className="hidden md:flex items-center gap-2">
              {/* Global city switcher — current city + dropdown of active
                  cities. Selecting routes to /explore?city=<name>, the
                  canonical city-filtered browse surface. */}
              <div ref={cityMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCityMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-sm transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-haspopup="listbox"
                  aria-expanded={cityMenuOpen}
                  aria-label={`Change city, current city ${city}`}
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <MapPin size={16} strokeWidth={1.5} />
                  <span
                    className="text-xs uppercase"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.12em',
                      color: 'var(--color-text)',
                    }}
                  >
                    {city}
                  </span>
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    style={{
                      transform: cityMenuOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                </button>
                {cityMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Cities"
                    className="absolute right-0 mt-1 w-48 max-h-80 overflow-y-auto rounded-sm shadow-2xl py-1 z-50"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {cityOptions.map((name) => {
                      const selected = name === city
                      return (
                        <button
                          key={name}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectCity(name)}
                          className="flex w-full items-center px-4 py-2.5 text-xs uppercase transition-colors hover:bg-gray-100"
                          style={{
                            fontFamily: 'var(--font-body)',
                            letterSpacing: '0.1em',
                            fontWeight: selected ? 500 : 400,
                            color: selected ? 'var(--color-text)' : 'var(--color-text-secondary)',
                            backgroundColor: selected
                              ? 'color-mix(in srgb, var(--color-action) 8%, transparent)'
                              : 'transparent',
                          }}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {user ? (
                <Link
                  href="/profile"
                  aria-label="Account"
                  aria-current={isActivePath(pathname, '/profile') ? 'page' : undefined}
                  className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: 'var(--color-action)',
                    border: isActivePath(pathname, '/profile')
                      ? '2px solid var(--color-text)'
                      : '2px solid transparent',
                  }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span
                      className="text-xs font-medium uppercase"
                      style={{ fontFamily: 'var(--font-body)', color: 'var(--color-on-action)' }}
                    >
                      {accountInitial}
                    </span>
                  )}
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
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
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

      {/* Mobile menu overlay — promoted to a proper dialog so screen
          readers announce it as a modal rather than reading the page
          behind it as inline content. `aria-modal` blocks AT navigation
          outside the dialog; `aria-label` names the dialog explicitly. */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <div
            ref={drawerRef}
            id="mobile-nav-drawer"
            className="absolute top-0 right-0 w-72 h-full shadow-2xl"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
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

            {/* Mobile city switcher — a labelled native-feel list. Lives
                inside the drawer so its controls stay within the focus
                trap. Selecting a city closes the drawer and routes to the
                canonical /explore?city=<name> surface. */}
            <div
              className="px-5 py-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div
                className="flex items-center gap-1.5 mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <MapPin size={14} strokeWidth={1.5} />
                <span
                  className="text-[0.65rem] uppercase"
                  style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.14em' }}
                >
                  City
                </span>
              </div>
              <div role="listbox" aria-label="Cities" className="flex flex-wrap gap-1.5">
                {cityOptions.map((name) => {
                  const selected = name === city
                  return (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectCity(name)}
                      className="px-2.5 py-1.5 rounded-sm text-[0.7rem] uppercase transition-colors"
                      style={{
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.08em',
                        fontWeight: selected ? 500 : 400,
                        color: selected ? 'var(--color-text)' : 'var(--color-text-secondary)',
                        backgroundColor: selected
                          ? 'color-mix(in srgb, var(--color-action) 12%, transparent)'
                          : 'transparent',
                        border: selected
                          ? '1px solid var(--color-action)'
                          : '1px solid var(--color-border)',
                      }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="py-2">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    aria-current={active ? 'page' : undefined}
                    className="flex items-center px-5 py-3.5 text-xs uppercase transition-colors"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.12em',
                      fontWeight: active ? 500 : 400,
                      color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      backgroundColor: active
                        ? 'color-mix(in srgb, var(--color-action) 8%, transparent)'
                        : 'transparent',
                      borderLeft: active ? '2px solid var(--color-action)' : '2px solid transparent',
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
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      openSignInModal({ mode: 'signup' })
                    }}
                    className="block w-full text-center py-2.5 rounded-sm text-xs uppercase tracking-wider font-medium transition-all hover:opacity-90"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      color: 'var(--color-on-action)',
                      backgroundColor: 'var(--color-action)',
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
