'use client'

import { useEffect, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFavorites, useCollections } from '@/lib/collections'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardCompactSkeleton } from '@/components/LoadingSkeleton'
import type { Restaurant } from '@/types/database'

/**
 * /saved — the Saved/Bookmarks destination (UI Wave 7).
 *
 * Works fully for ANONYMOUS users: favorites and named collections live
 * in localStorage via `src/lib/collections.ts`. We subscribe to the
 * store with `useFavorites` / `useCollections` (SSR-safe
 * useSyncExternalStore wrappers that report empty on the server and the
 * first client render, then hydrate without a flash), gather every
 * restaurant id referenced across favorites + collections, fetch those
 * rows once from Supabase client-side, and render them through the
 * canonical RestaurantCard (compact). Collections render as their own
 * sections beneath the flat favorites grid.
 *
 * Because the source of truth is client-side localStorage, all data
 * loading happens in a useEffect — never server-side.
 */

const GRID =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'

export default function SavedPage() {
  const favorites = useFavorites()
  const collections = useCollections()

  const [byId, setById] = useState<Map<string, Restaurant>>(new Map())
  const [loading, setLoading] = useState(true)

  // Union of every id referenced by favorites + every collection, so we
  // fetch each restaurant exactly once regardless of how many lists it
  // appears in. Keyed on the sorted-join below so the effect only
  // re-fetches when the actual set of ids changes (not on every render —
  // the store hands back stable references, but membership can shift).
  const allIds = Array.from(
    new Set([
      ...favorites,
      ...collections.flatMap((c) => c.restaurantIds),
    ]),
  )
  const key = [...allIds].sort().join(',')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (allIds.length === 0) {
        if (!cancelled) {
          setById(new Map())
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', allIds)
      if (cancelled) return
      if (error) {
        console.error('SavedPage load failed:', error)
        setById(new Map())
        setLoading(false)
        return
      }
      setById(new Map((data ?? []).map((r) => [r.id, r as Restaurant])))
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Re-order a list of ids into the canonical Restaurant rows we fetched,
  // preserving the stored sequence (most-recently-saved first) and
  // skipping ids whose row didn't come back (deleted / unpublished).
  const resolve = (ids: string[]): Restaurant[] => {
    const out: Restaurant[] = []
    for (const id of ids) {
      const row = byId.get(id)
      if (row) out.push(row)
    }
    return out
  }

  const favoriteRestaurants = resolve(favorites)
  const nonEmptyCollections = collections
    .map((c) => ({ collection: c, restaurants: resolve(c.restaurantIds) }))
    .filter((entry) => entry.restaurants.length > 0)

  const hasAnything =
    favoriteRestaurants.length > 0 || nonEmptyCollections.length > 0

  // div, not <main> — the root layout already wraps every page in
  // <main id="main-content">, and nested <main> landmarks are invalid
  // HTML / confuse screen-reader landmark navigation.
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <header className="mb-8">
          <h1
            className="text-3xl font-bold"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Saved
          </h1>
          <p
            className="mt-2 text-sm max-w-xl"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Your bookmarked restaurants and lists, kept on this device.
          </p>
        </header>

        {loading ? (
          <div className={GRID} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardCompactSkeleton key={i} />
            ))}
          </div>
        ) : !hasAnything ? (
          <EmptyState
            icon={Bookmark}
            title="Nothing saved yet"
            description="Bookmark restaurants as you browse and they'll show up here, ready whenever you are."
            ctaText="Explore restaurants"
            ctaHref="/explore"
          />
        ) : (
          <div className="space-y-12">
            {favoriteRestaurants.length > 0 && (
              <section aria-labelledby="saved-favorites-heading">
                <h2
                  id="saved-favorites-heading"
                  className="text-lg font-semibold mb-4"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  Bookmarks
                </h2>
                <div className={GRID}>
                  {favoriteRestaurants.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      variant="compact"
                    />
                  ))}
                </div>
              </section>
            )}

            {nonEmptyCollections.map(({ collection, restaurants }) => (
              <section
                key={collection.id}
                aria-labelledby={`collection-${collection.id}-heading`}
              >
                <h2
                  id={`collection-${collection.id}-heading`}
                  className="text-lg font-semibold mb-4"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {collection.name}
                  <span
                    className="ml-2 text-sm font-normal"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {restaurants.length}
                  </span>
                </h2>
                <div className={GRID}>
                  {restaurants.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      variant="compact"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
