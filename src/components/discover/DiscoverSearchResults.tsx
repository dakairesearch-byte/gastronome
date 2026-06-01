'use client'

/**
 * DiscoverSearchResults — the search-results body of /discover (Reformulation
 * v2). Rendered by the shell whenever ?q= is non-empty, regardless of mode.
 *
 * It runs the SINGLE data engine (useDiscoverResults) scoped to the active
 * city + the typed query, then lays the hits out as THREE calm, grouped
 * sections rather than one undifferentiated firehose:
 *
 *   1. Restaurants  — RestaurantCard (compact) with the ConsensusMeter score.
 *   2. Dishes       — each dish links to its restaurant's profile.
 *   3. Neighborhoods — distinct neighborhoods that match the query, each
 *      linking back into Browse filtered to that neighborhood.
 *
 * The shell owns the search input + URL; this component only reads { query,
 * city } and self-fetches. It respects RESULT_CAP (the engine caps the
 * restaurant slice) and surfaces loading + empty states plainly.
 *
 * SHARED CONTRACT: default export
 *   DiscoverSearchResults({ query, city }: { query: string; city: string })
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { MapPin, Search, Utensils } from 'lucide-react'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import useDiscoverResults, { RESULT_CAP } from '@/lib/hooks/useDiscoverResults'
import { DEFAULT_FILTERS, type SearchFilters } from '@/components/search/SearchFiltersSidebar'

/* ------------------------------------------------------------------ */
/*  Section heading — a calm hairline divider with an icon + label     */
/* ------------------------------------------------------------------ */

function SectionHeading({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Utensils
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span
        className="text-xs font-semibold flex items-center gap-1.5"
        style={{ color: 'var(--color-text)' }}
      >
        <Icon size={13} style={{ color: 'var(--color-text-secondary)' }} />
        {label}
        <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>
          ({count})
        </span>
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DiscoverSearchResults({
  query,
  city,
}: {
  query: string
  city: string
}) {
  // City-scoped filter set: everything default except the active city, so the
  // engine searches within the city the user is browsing. (mode 'all' returns
  // both restaurants and dishes.)
  const filters = useMemo<SearchFilters>(
    () => ({ ...DEFAULT_FILTERS, cities: city ? [city] : [] }),
    [city]
  )

  const { restaurants, dishes, neighborhoods, loading, total } = useDiscoverResults({
    filters,
    sort: 'gastronome',
    query,
  })

  // Neighborhood hits: the engine returns the city's full neighborhood facet;
  // we surface only those whose name matches the typed query (case-insensitive
  // substring), capped to a calm handful.
  const neighborhoodHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return neighborhoods.filter((n) => n.toLowerCase().includes(q)).slice(0, 8)
  }, [neighborhoods, query])

  const trimmed = query.trim()

  /* ---------------------------- loading ---------------------------- */
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Searching for &ldquo;{trimmed}&rdquo;…
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  /* ----------------------------- empty ----------------------------- */
  const hasAny = total > 0 || neighborhoodHits.length > 0
  if (!hasAny) {
    return (
      <EmptyState
        icon={Search}
        tone="attention"
        title="Nothing matches yet"
        description={`Nothing for “${trimmed}” in ${city}. Try a broader term, or check your spelling.`}
      />
    )
  }

  /* ---------------------------- results ---------------------------- */
  const restaurantsCapped = restaurants.length >= RESULT_CAP

  return (
    <div className="space-y-6">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Results for{' '}
        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
          &ldquo;{trimmed}&rdquo;
        </span>{' '}
        in {city}
      </p>

      {/* 1 · Restaurants */}
      {restaurants.length > 0 && (
        <section className="space-y-3">
          <SectionHeading icon={MapPin} label="Restaurants" count={restaurants.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {restaurants.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} variant="compact" />
            ))}
          </div>
          {restaurantsCapped && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Showing the top {RESULT_CAP} — refine your search to narrow this list.
            </p>
          )}
        </section>
      )}

      {/* 2 · Dishes — each links to its restaurant's profile */}
      {dishes.length > 0 && (
        <section className="space-y-3">
          <SectionHeading icon={Utensils} label="Dishes" count={dishes.length} />
          <div className="space-y-2.5">
            {dishes.map((d, i) => (
              <Link
                key={`${d.restaurant.id}-${d.dish_name}-${i}`}
                href={`/restaurants/${d.restaurant.id}`}
                className="block rounded-lg border p-4 hover:shadow-md transition-shadow"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-secondary)' }}
                  >
                    <Utensils size={18} style={{ color: 'var(--color-action)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {d.dish_name}
                      </p>
                      {d.isTopDish && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{
                            color: 'var(--color-action)',
                            backgroundColor:
                              'color-mix(in srgb, var(--color-action) 14%, var(--color-surface))',
                          }}
                        >
                          Top dish
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs truncate"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      at {d.restaurant.name}
                      {d.restaurant.neighborhood ? ` · ${d.restaurant.neighborhood}` : ''}
                    </p>
                  </div>
                  {d.mention_count > 0 && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        color: 'var(--color-action)',
                        backgroundColor:
                          'color-mix(in srgb, var(--color-action) 10%, var(--color-surface))',
                      }}
                    >
                      {d.mention_count} {d.mention_count === 1 ? 'mention' : 'mentions'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3 · Neighborhoods — each re-runs search scoped to that neighborhood.
          We route through ?q=<neighborhood> (which the engine matches via
          neighborhood.ilike) rather than a ?nbhd= param the shell doesn't read,
          so the link lands on a real, relevant result set. */}
      {neighborhoodHits.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            icon={MapPin}
            label="Neighborhoods"
            count={neighborhoodHits.length}
          />
          <div className="flex flex-wrap gap-2">
            {neighborhoodHits.map((n) => (
              <Link
                key={n}
                href={`/discover?city=${encodeURIComponent(city)}&q=${encodeURIComponent(n)}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm transition-colors hover:shadow-sm"
                style={{
                  color: 'var(--color-text)',
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <MapPin size={14} style={{ color: 'var(--color-action)' }} />
                {n}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
