'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Sliders } from 'lucide-react'
import SearchAutocomplete from '@/components/search/SearchAutocomplete'
import { exploreFacetsToSearchURL } from '@/components/search/filterState'

interface ExploreSearchBarProps {
  cities: string[]
  /** City currently reflected in the URL; drives the picker's initial label. */
  initialCity?: string
}

export default function ExploreSearchBar({
  cities,
  initialCity,
}: ExploreSearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCity, setSelectedCity] = useState(
    initialCity || cities[0] || 'New York'
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Keep the label in sync when the URL changes (e.g. browser back/forward).
  useEffect(() => {
    if (initialCity && initialCity !== selectedCity) {
      setSelectedCity(initialCity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCity])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const pickCity = (city: string) => {
    setSelectedCity(city)
    setMenuOpen(false)
    // Push the city into the URL so the server re-renders Top 10 Trending
    // and the map for the new city. Preserve the other active explore facets
    // (cuisine/accolade/stars/q) instead of dropping them. Using push (not
    // replace) keeps browser back/forward working as users expect.
    const next = new URLSearchParams(searchParams?.toString() ?? '')
    next.set('city', city)
    router.push(`/explore?${next.toString()}`)
  }

  // Compose the live explore facets in the URL into a faceted /search query
  // and navigate there. consensus_picks is non-transferable; the helper
  // returns an /explore URL in that case (handled inside filterState).
  const runCustomSearch = () => {
    const starsRaw = searchParams?.get('stars')
    const starsNum = starsRaw ? Number(starsRaw) : undefined
    router.push(
      exploreFacetsToSearchURL({
        city: searchParams?.get('city') ?? selectedCity,
        cuisine: searchParams?.get('cuisine') ?? undefined,
        accolade: searchParams?.get('accolade') ?? undefined,
        stars:
          starsNum !== undefined && Number.isFinite(starsNum)
            ? starsNum
            : undefined,
        q: searchParams?.get('q') ?? undefined,
      })
    )
  }

  return (
    <div
      className="py-6 border-b"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottomColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="flex items-center gap-0 rounded-full border overflow-visible shadow-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex-1 min-w-0">
            <SearchAutocomplete
              variant="bar"
              placeholder="Search restaurants, cuisine, dishes..."
              city={selectedCity}
            />
          </div>

          <button
            type="button"
            onClick={runCustomSearch}
            aria-label="Custom search"
            className="inline-flex items-center gap-2 flex-shrink-0 mr-1 my-1 px-3 sm:px-4 py-2.5 rounded-full transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Sliders size={15} />
            <span
              className="hidden sm:inline text-[12px] uppercase font-medium"
              style={{ letterSpacing: '0.06em' }}
            >
              Custom search
            </span>
          </button>

          <div
            className="w-px h-7 flex-shrink-0"
            style={{ backgroundColor: 'var(--color-border)' }}
          />

          <div ref={wrapRef} className="relative flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-r-full transition-colors hover:bg-white/60"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text)',
              }}
            >
              <span
                className="text-[10px] uppercase font-medium"
                style={{
                  letterSpacing: '0.14em',
                  color: 'var(--color-text-secondary)',
                }}
              >
                City
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '15px',
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                {selectedCity}
              </span>
              <ChevronDown
                size={16}
                className="transition-transform"
                style={{
                  color: 'var(--color-text-secondary)',
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)',
                }}
              />
            </button>

            {menuOpen && (
              <div
                role="listbox"
                className="absolute top-full right-0 mt-2.5 min-w-[260px] border p-2 z-50"
                style={{
                  backgroundColor: '#fff',
                  borderColor: 'var(--color-border)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
                }}
              >
                <div
                  className="px-3 pt-2.5 pb-2 text-[10px] uppercase font-medium"
                  style={{
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.14em',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Browse by city
                </div>
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    role="option"
                    aria-selected={city === selectedCity}
                    onClick={() => pickCity(city)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text)',
                      borderRadius: '6px',
                      backgroundColor: city === selectedCity ? 'var(--color-surface)' : 'transparent',
                    }}
                  >
                    <span>{city}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
