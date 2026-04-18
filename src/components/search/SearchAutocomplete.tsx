'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, MapPin, Loader2 } from 'lucide-react'
import type { Restaurant } from '@/types/database'
import { recordSearch } from '@/components/home/RecentSearches'

interface SearchAutocompleteProps {
  /**
   * - `hero` — big centered input with a gold "Explore" CTA, matches the
   *   homepage hero.
   * - `bar`  — full-width input with a "Search" CTA, matches the explore
   *   page filter bar.
   */
  variant: 'hero' | 'bar'
  placeholder?: string
  /** Optional city filter piped through to the API (`&city=…`). */
  city?: string
}

type Suggestion = Pick<
  Restaurant,
  'id' | 'name' | 'cuisine' | 'city' | 'neighborhood'
>

const DEBOUNCE_MS = 200
const MIN_CHARS = 2
const MAX_SUGGESTIONS = 8

/**
 * Live restaurant autocomplete.
 *
 * Fires a debounced request to `/api/restaurants/search` as the user
 * types (starting at 2 chars) and renders the top matches directly
 * under the input. Arrow keys move through results, Enter picks the
 * highlighted one or — when nothing is highlighted — falls back to the
 * existing `/search?q=` route so long-tail queries still resolve.
 *
 * Because the dropdown is positioned absolutely, callers can drop this
 * anywhere without worrying about layout shift.
 */
export default function SearchAutocomplete({
  variant,
  placeholder,
  city,
}: SearchAutocompleteProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const latestQueryRef = useRef('')

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Debounced fetch. We key the effect on `query` directly — clearing
  // the timer on each keystroke collapses rapid input into a single
  // network call. AbortController cancels stale in-flight responses so
  // "lasagna" never overwrites the freshest "lasagna bolognese" result.
  useEffect(() => {
    const trimmed = query.trim()
    latestQueryRef.current = trimmed

    if (trimmed.length < MIN_CHARS) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: trimmed })
        if (city) params.set('city', city)
        const res = await fetch(`/api/restaurants/search?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`search ${res.status}`)
        const body = (await res.json()) as { local?: Suggestion[] }
        if (latestQueryRef.current !== trimmed) return
        const rows = Array.isArray(body.local) ? body.local : []
        setSuggestions(rows.slice(0, MAX_SUGGESTIONS))
        setActiveIndex(-1)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('autocomplete fetch failed:', err)
      } finally {
        if (latestQueryRef.current === trimmed) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, city])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      router.push('/explore')
      return
    }
    recordSearch(trimmed)
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const go = (s: Suggestion) => {
    recordSearch(s.name)
    setOpen(false)
    setQuery('')
    router.push(`/restaurants/${s.id}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      go(suggestions[activeIndex])
      return
    }
    submit(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    }
  }

  const dropdownVisible =
    open &&
    query.trim().length >= MIN_CHARS &&
    (loading || suggestions.length > 0)

  const inputEl = (
    <input
      ref={inputRef}
      type="text"
      value={query}
      onChange={(e) => {
        setQuery(e.target.value)
        setOpen(true)
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder ?? 'Search exceptional dining...'}
      autoComplete="off"
      aria-autocomplete="list"
      aria-expanded={dropdownVisible}
      role="combobox"
      className="flex-1 bg-transparent outline-none min-w-0"
      style={{
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        fontSize: '15px',
      }}
    />
  )

  const submitBtn =
    variant === 'hero' ? (
      <button
        type="submit"
        className="px-6 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
        style={{
          backgroundColor: 'var(--color-primary)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.16em',
          fontWeight: 500,
        }}
      >
        Explore
      </button>
    ) : (
      <button
        type="submit"
        className="px-6 py-2.5 transition-all hover:opacity-90 tracking-wider uppercase text-xs rounded-sm"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-surface)',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
        }}
      >
        Search
      </button>
    )

  const containerClass =
    variant === 'hero'
      ? 'flex items-center gap-3 px-5 py-3 border rounded-sm shadow-sm transition-shadow hover:shadow-lg'
      : 'flex items-center gap-3 pl-5 pr-4 py-3'

  return (
    <div ref={rootRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={containerClass}
          style={{
            backgroundColor:
              variant === 'hero'
                ? 'var(--color-background)'
                : 'transparent',
            borderColor: variant === 'hero' ? 'var(--color-border)' : 'transparent',
          }}
        >
          <Search
            className="h-5 w-5 flex-shrink-0"
            style={{ color: 'var(--color-accent)' }}
          />
          {inputEl}
          {loading && (
            <Loader2
              className="h-4 w-4 animate-spin flex-shrink-0"
              style={{ color: 'var(--color-accent)' }}
              aria-hidden
            />
          )}
          {variant === 'hero' && submitBtn}
        </div>
      </form>

      {dropdownVisible && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-sm border shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {suggestions.length === 0 && loading ? (
            <div
              className="px-5 py-4 text-sm text-left"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Searching…
            </div>
          ) : suggestions.length === 0 ? (
            <div
              className="px-5 py-4 text-sm text-left"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              No matches. Press Enter to search anyway.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {suggestions.map((s, i) => {
                const active = i === activeIndex
                const location = [s.neighborhood, s.city].filter(Boolean).join(' · ')
                return (
                  <li key={s.id} role="option" aria-selected={active}>
                    <Link
                      href={`/restaurants/${s.id}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={(e) => {
                        e.preventDefault()
                        go(s)
                      }}
                      className="flex items-center gap-3 px-5 py-3 text-left transition-colors"
                      style={{
                        backgroundColor: active
                          ? 'var(--color-background)'
                          : 'transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate"
                          style={{
                            color: 'var(--color-text)',
                            fontFamily: 'var(--font-heading)',
                            fontSize: '15px',
                            fontWeight: 500,
                          }}
                        >
                          {s.name}
                        </p>
                        <div
                          className="flex items-center gap-1.5 mt-0.5 text-xs truncate"
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {s.cuisine && s.cuisine !== 'Restaurant' && (
                            <>
                              <span>{s.cuisine}</span>
                              {location && <span>·</span>}
                            </>
                          )}
                          {location && (
                            <>
                              <MapPin size={11} className="flex-shrink-0" />
                              <span className="truncate">{location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
