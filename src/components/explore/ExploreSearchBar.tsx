'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, PlusCircle } from 'lucide-react'
import SearchAutocomplete from '@/components/search/SearchAutocomplete'

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
  const [selectedCity, setSelectedCity] = useState(
    initialCity || cities[0] || 'New York'
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [customActive, setCustomActive] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

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
        setCustomActive(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const pickCity = (city: string) => {
    setSelectedCity(city)
    setMenuOpen(false)
    setCustomActive(false)
    setCustomValue('')
    setCustomError('')
    // Push the city into the URL so the server re-renders Top 10 Trending
    // and the map for the new city. Using push (not replace) keeps browser
    // back/forward working as users expect.
    router.push(`/explore?city=${encodeURIComponent(city)}`)
  }

  const handleCustomTrigger = () => {
    setCustomActive(true)
    setCustomError('')
    setTimeout(() => customInputRef.current?.focus(), 50)
  }

  // Free-text city entry used to route blindly to /explore?city=<freeform>,
  // which lands on an empty page for any city we don't actually cover.
  // Validate against the known-cities list (case-insensitively) and route
  // to the canonical label; otherwise surface a "not covered yet" hint
  // instead of navigating to a dead page.
  const submitCustomCity = () => {
    const v = customValue.trim()
    if (!v) return
    const match = cities.find((c) => c.toLowerCase() === v.toLowerCase())
    if (match) {
      pickCity(match)
    } else {
      setCustomError(`We don't cover ${v} yet — try one of the cities above.`)
    }
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitCustomCity()
    } else if (e.key === 'Escape') {
      setCustomActive(false)
      setCustomValue('')
      setCustomError('')
    }
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

          <div
            className="w-px h-7 flex-shrink-0"
            style={{ backgroundColor: 'var(--color-border)' }}
          />

          <div ref={wrapRef} className="relative flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(!menuOpen)
                if (menuOpen) setCustomActive(false)
              }}
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
                {!customActive && (
                  <>
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
                    <button
                      type="button"
                      onClick={handleCustomTrigger}
                      className="w-full flex items-center gap-2 px-3 pt-3.5 pb-2.5 text-left text-sm font-medium border-t mt-1.5"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-accent)',
                        borderColor: 'var(--color-border)',
                        borderRadius: 0,
                      }}
                    >
                      <PlusCircle size={14} />
                      <span>Custom...</span>
                    </button>
                  </>
                )}

                {customActive && (
                  <div className="p-1.5">
                    <input
                      ref={customInputRef}
                      type="text"
                      value={customValue}
                      onChange={(e) => {
                        setCustomValue(e.target.value)
                        if (customError) setCustomError('')
                      }}
                      onKeyDown={handleCustomKeyDown}
                      placeholder="Enter a city..."
                      autoComplete="off"
                      aria-invalid={customError ? true : undefined}
                      className="w-full px-3 py-2.5 border text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text)',
                        borderColor: customError ? '#c0392b' : 'var(--color-border)',
                        borderRadius: '6px',
                        fontSize: '16px',
                      }}
                    />
                    {customError ? (
                      <p
                        className="mt-2 px-0.5 text-[11px]"
                        role="alert"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: '#c0392b',
                        }}
                      >
                        {customError}
                      </p>
                    ) : (
                      <p
                        className="mt-2 px-0.5 text-[11px]"
                        style={{
                          fontFamily: 'var(--font-body)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Press Enter to apply · Esc to cancel
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
