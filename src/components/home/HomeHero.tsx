'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

/**
 * Homepage hero — Figma "Culinary Excellence" block.
 *
 * Editorial title + subtitle on a dot-pattern background, centered search
 * with the gold "Explore" CTA, and a row of filter chips that route to
 * /explore with the appropriate query param.
 */

const FILTER_CHIPS = [
  { label: 'Nearby', href: '/explore?filter=nearby' },
  { label: 'Trending', href: '/explore?filter=trending' },
  { label: 'Fine Dining', href: '/explore?cuisine=fine-dining' },
  { label: 'New Openings', href: '/explore?filter=new' },
] as const

export default function HomeHero() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      router.push('/explore')
      return
    }
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Subtle dot-pattern background — pure CSS, no image dependency. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--color-accent) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-8 py-24 lg:py-32 text-center">
        <h1
          className="text-5xl sm:text-6xl lg:text-7xl mb-6"
          style={{
            color: 'var(--color-text)',
            fontFamily: "'Spectral', serif",
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Culinary Excellence
        </h1>
        <p
          className="text-base sm:text-lg max-w-2xl mx-auto mb-12"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            lineHeight: 1.6,
          }}
        >
          Where discerning palates discover extraordinary dining experiences
        </p>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div
            className="flex items-center gap-3 px-5 py-3 border rounded-sm shadow-sm transition-shadow hover:shadow-lg"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
            }}
          >
            <Search
              className="h-5 w-5 flex-shrink-0"
              style={{ color: 'var(--color-accent)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exceptional dining..."
              className="flex-1 bg-transparent outline-none"
              style={{
                color: 'var(--color-text)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '15px',
              }}
            />
            <button
              type="submit"
              className="px-6 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--color-primary)',
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.16em',
                fontWeight: 500,
              }}
            >
              Explore
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => router.push(chip.href)}
              className="px-5 py-2 text-xs uppercase border rounded-full transition-colors hover:bg-white"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.14em',
                fontWeight: 400,
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border)',
                backgroundColor: 'transparent',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
