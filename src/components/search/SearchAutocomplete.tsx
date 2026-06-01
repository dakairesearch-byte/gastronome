'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, MapPin, Utensils, Store, Loader2 } from 'lucide-react'
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

interface NeighborhoodHit {
  neighborhood: string
  city: string
  count: number
}

interface DishHit {
  dish_name: string
  restaurant_id: string
  restaurant_name: string
}

/** Shape returned by /api/restaurants/search (Doer A). `local` is a
 *  back-compat alias for `restaurants`. */
interface SearchResponse {
  restaurants?: Suggestion[]
  local?: Suggestion[]
  neighborhoods?: NeighborhoodHit[]
  dishes?: DishHit[]
}

// A single keyboard-navigable row, flattened across all three groups so
// ArrowUp/Down/Enter traverse the whole dropdown uniformly. `run` performs
// the row's navigation.
type FlatItem =
  | { kind: 'restaurant'; key: string; data: Suggestion; run: () => void }
  | { kind: 'neighborhood'; key: string; data: NeighborhoodHit; run: () => void }
  | { kind: 'dish'; key: string; data: DishHit; run: () => void }

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
  const listboxId = useId()

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodHit[]>([])
  const [dishes, setDishes] = useState<DishHit[]>([])
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
      setNeighborhoods([])
      setDishes([])
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
        const body = (await res.json()) as SearchResponse
        if (latestQueryRef.current !== trimmed) return
        // Prefer the canonical `restaurants` key; fall back to the legacy
        // `local` alias for back-compat with older API responses.
        const rows = Array.isArray(body.restaurants)
          ? body.restaurants
          : Array.isArray(body.local)
            ? body.local
            : []
        setSuggestions(rows.slice(0, MAX_SUGGESTIONS))
        setNeighborhoods(
          Array.isArray(body.neighborhoods) ? body.neighborhoods : []
        )
        setDishes(Array.isArray(body.dishes) ? body.dishes : [])
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

  const goNeighborhood = (n: NeighborhoodHit) => {
    recordSearch(n.neighborhood)
    setOpen(false)
    setQuery('')
    // Canonical neighborhood filter param is `nbhd` (filterState round-trips it
    // + the /search page shows a "Restaurants in {Neighborhood}" header for a
    // single-nbhd facet). Must match — `?neighborhood=` is NOT read.
    router.push(`/search?nbhd=${encodeURIComponent(n.neighborhood)}`)
  }

  const goDish = (d: DishHit) => {
    recordSearch(d.dish_name)
    setOpen(false)
    setQuery('')
    router.push(
      `/search?q=${encodeURIComponent(d.dish_name)}&mode=dishes`
    )
  }

  // Flatten every group into one ordered list so keyboard traversal and
  // the Enter fallback treat the dropdown as a single column. Order matches
  // the visual render order: restaurants, neighborhoods, dishes.
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = []
    for (const s of suggestions) {
      items.push({
        kind: 'restaurant',
        key: `r:${s.id}`,
        data: s,
        run: () => go(s),
      })
    }
    for (const n of neighborhoods) {
      items.push({
        kind: 'neighborhood',
        key: `n:${n.neighborhood}:${n.city}`,
        data: n,
        run: () => goNeighborhood(n),
      })
    }
    for (const d of dishes) {
      items.push({
        kind: 'dish',
        key: `d:${d.dish_name}:${d.restaurant_id}`,
        data: d,
        run: () => goDish(d),
      })
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, neighborhoods, dishes])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const active = activeIndex >= 0 ? flatItems[activeIndex] : undefined
    if (active) {
      active.run()
      return
    }
    submit(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || flatItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % flatItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1))
    }
  }

  // Once the query clears the minimum length we always show the dropdown
  // — even with zero suggestions — so the persistent "Search all results"
  // footer is reachable for long-tail queries that match no restaurant.
  const dropdownVisible = open && query.trim().length >= MIN_CHARS

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
      aria-controls={listboxId}
      role="combobox"
      className="flex-1 bg-transparent outline-none min-w-0"
      style={{
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        fontSize: '16px',
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
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-sm border shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {flatItems.length === 0 && loading ? (
            <div
              className="px-5 py-4 text-sm text-left"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Searching…
            </div>
          ) : flatItems.length === 0 ? (
            <div
              className="px-5 py-4 text-sm text-left"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              No matches yet.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {flatItems.map((item, i) => {
                const active = i === activeIndex
                // Section header: render above the first row of each group.
                const showHeader =
                  i === 0 || flatItems[i - 1].kind !== item.kind
                const header =
                  item.kind === 'restaurant'
                    ? 'Restaurants'
                    : item.kind === 'neighborhood'
                      ? 'Neighborhoods'
                      : 'Dishes'

                const rowBg = active
                  ? 'var(--color-background)'
                  : 'transparent'

                return (
                  <li key={item.key} role="presentation">
                    {showHeader && (
                      <p
                        className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-wider"
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-body)',
                          letterSpacing: '0.12em',
                          borderTop:
                            i === 0
                              ? 'none'
                              : '1px solid var(--color-border)',
                        }}
                      >
                        {header}
                      </p>
                    )}

                    {item.kind === 'restaurant' ? (
                      (() => {
                        const s = item.data
                        const location = [s.neighborhood, s.city]
                          .filter(Boolean)
                          .join(' · ')
                        return (
                          <Link
                            href={`/restaurants/${s.id}`}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={(e) => {
                              e.preventDefault()
                              item.run()
                            }}
                            className="flex items-center gap-3 px-5 py-2.5 text-left transition-colors"
                            style={{ backgroundColor: rowBg }}
                          >
                            <Store
                              size={15}
                              className="flex-shrink-0"
                              style={{ color: 'var(--color-accent)' }}
                              aria-hidden
                            />
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
                        )
                      })()
                    ) : item.kind === 'neighborhood' ? (
                      (() => {
                        const n = item.data
                        return (
                          <Link
                            href={`/search?nbhd=${encodeURIComponent(
                              n.neighborhood
                            )}`}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={(e) => {
                              e.preventDefault()
                              item.run()
                            }}
                            className="flex items-center gap-3 px-5 py-2.5 text-left transition-colors"
                            style={{ backgroundColor: rowBg }}
                          >
                            <MapPin
                              size={15}
                              className="flex-shrink-0"
                              style={{ color: 'var(--color-accent)' }}
                              aria-hidden
                            />
                            <p
                              className="flex-1 min-w-0 truncate"
                              style={{
                                color: 'var(--color-text)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '14px',
                              }}
                            >
                              {n.neighborhood}
                              {n.city && (
                                <span
                                  style={{
                                    color: 'var(--color-text-secondary)',
                                  }}
                                >
                                  {' · '}
                                  {n.city}
                                </span>
                              )}
                              {n.count > 0 && (
                                <span
                                  style={{
                                    color: 'var(--color-text-secondary)',
                                  }}
                                >
                                  {' '}
                                  ({n.count})
                                </span>
                              )}
                            </p>
                          </Link>
                        )
                      })()
                    ) : (
                      (() => {
                        const d = item.data
                        return (
                          <Link
                            href={`/search?q=${encodeURIComponent(
                              d.dish_name
                            )}&mode=dishes`}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={(e) => {
                              e.preventDefault()
                              item.run()
                            }}
                            className="flex items-center gap-3 px-5 py-2.5 text-left transition-colors"
                            style={{ backgroundColor: rowBg }}
                          >
                            <Utensils
                              size={15}
                              className="flex-shrink-0"
                              style={{ color: 'var(--color-accent)' }}
                              aria-hidden
                            />
                            <p
                              className="flex-1 min-w-0 truncate"
                              style={{
                                color: 'var(--color-text)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '14px',
                              }}
                            >
                              <span style={{ fontWeight: 500 }}>
                                {d.dish_name}
                              </span>
                              {d.restaurant_name && (
                                <span
                                  style={{
                                    color: 'var(--color-text-secondary)',
                                  }}
                                >
                                  {' — at '}
                                  {d.restaurant_name}
                                </span>
                              )}
                            </p>
                          </Link>
                        )
                      })()
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* Persistent full-search escape hatch. Always present (even with
              zero suggestions) so long-tail queries that match no restaurant
              still have a one-click path to /search?q=. Mirrors the Enter
              fallback in handleSubmit. Uses onMouseDown so it fires before
              the input's blur closes the dropdown. */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              submit(query)
            }}
            className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm transition-colors hover:opacity-90"
            style={{
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
            <span className="truncate">
              Search all results for{' '}
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                &ldquo;{query.trim()}&rdquo;
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
