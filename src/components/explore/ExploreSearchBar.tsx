'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronDown, PlusCircle } from 'lucide-react'
import SearchAutocomplete from '@/components/search/SearchAutocomplete'

interface ExploreSearchBarProps {
  cities: string[]
}

export default function ExploreSearchBar({ cities }: ExploreSearchBarProps) {
  const [selectedCity, setSelectedCity] = useState(cities[0] ?? 'New York')
  const [menuOpen, setMenuOpen] = useState(false)
  const [customActive, setCustomActive] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

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

  const handleCustomTrigger = () => {
    setCustomActive(true)
    setTimeout(() => customInputRef.current?.focus(), 50)
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = customValue.trim()
      if (v) {
        setSelectedCity(v)
        setMenuOpen(false)
        setCustomActive(false)
        setCustomValue('')
      }
    } else if (e.key === 'Escape') {
      setCustomActive(false)
      setCustomValue('')
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
                        onClick={() => {
                          setSelectedCity(city)
                          setMenuOpen(false)
                        }}
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
                      onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={handleCustomKeyDown}
                      placeholder="Enter a city..."
                      autoComplete="off"
                      className="w-full px-3 py-2.5 border text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-border)',
                        borderRadius: '6px',
                      }}
                    />
                    <p
                      className="mt-2 px-0.5 text-[11px]"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      Press Enter to apply · Esc to cancel
                    </p>
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
