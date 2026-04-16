'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/explore', label: 'Explore' },
  { path: '/community', label: 'Community' },
]

export default function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change (React-safe derived-state pattern)
  const [tracked, setTracked] = useState(pathname)
  if (tracked !== pathname) {
    setTracked(pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

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
            {/* Logo — circular monogram, no wordmark per Figma */}
            <Link href="/" className="flex items-center" aria-label="Gastronome">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white shadow-sm"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  fontFamily: "'Spectral', serif",
                  fontWeight: 500,
                  fontSize: '20px',
                  letterSpacing: '-0.02em',
                }}
              >
                G
              </div>
            </Link>

            {/* Desktop nav — centered cluster */}
            <nav className="hidden md:flex items-center gap-10">
              {navItems.map((item) => {
                const active = isActive(item.path)
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
                        fontFamily: "'DM Sans', sans-serif",
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

            {/* Right-side spacer keeps centered nav balanced; matches Figma */}
            <div className="hidden md:block w-12" aria-hidden="true" />

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
                style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}
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
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className="flex items-center px-5 py-3.5 text-xs uppercase transition-colors"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
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
          </div>
        </div>
      )}
    </>
  )
}
