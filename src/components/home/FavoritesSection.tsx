'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFavorites } from '@/lib/collections'
import { displayCuisine, getRestaurantPhotoUrl } from '@/lib/restaurant'
import { formatRating } from '@/lib/format'
import type { Restaurant } from '@/types/database'

/**
 * "Your Favorites" section — client component.
 *
 * The favorites list itself lives in `src/lib/collections.ts` so the
 * detail page's `BookmarkButton` and this rail share one store. The
 * `useFavorites` hook wraps `useSyncExternalStore` so SSR and the
 * first client render agree on an empty list — real data flows in
 * after the store subscription fires, avoiding the hydration flash.
 */

export default function FavoritesSection() {
  const ids = useFavorites()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  // `ids` is a stable reference from the store until favorites change,
  // so keying the effect on the JSON form avoids re-fetching on every
  // re-render while still reacting when the list actually changes.
  const key = ids.slice(0, 6).join(',')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sliceIds = ids.slice(0, 6)
      if (sliceIds.length === 0) {
        if (!cancelled) {
          setRestaurants([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select(
          'id, name, cuisine, photo_url, google_photo_url, yelp_photo_url, google_rating, yelp_rating'
        )
        .in('id', sliceIds)
      if (cancelled) return
      if (error) {
        console.error('FavoritesSection load failed:', error)
        setRestaurants([])
        setLoading(false)
        return
      }
      // Supabase returns rows in arbitrary order; re-order to match the
      // stored favorite sequence so the user's most-recent favorite
      // renders first.
      const byId = new Map((data ?? []).map((r) => [r.id, r as Restaurant]))
      const ordered: Restaurant[] = []
      for (const id of sliceIds) {
        const row = byId.get(id)
        if (row) ordered.push(row)
      }
      setRestaurants(ordered)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [key, ids])

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-shimmer h-16 rounded-sm" />
        ))}
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div
        className="rounded-sm p-6 text-center"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <p
          className="text-sm mb-3"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          No favorites yet. Explore restaurants and tap the heart to save them.
        </p>
        <Link
          href="/explore"
          className="inline-block px-6 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm text-white transition-all hover:opacity-90"
          style={{
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.1em',
            backgroundColor: 'var(--color-primary)',
          }}
        >
          Start exploring
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {restaurants.map((r) => {
        const photo = getRestaurantPhotoUrl(r)
        const rating = formatRating(r.google_rating ?? r.yelp_rating)
        return (
          <Link
            key={r.id}
            href={`/restaurants/${r.id}`}
            className="flex items-center gap-5 p-5 cursor-pointer transition-all hover:shadow-lg rounded-sm"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={r.name} className="w-20 h-20 object-cover rounded-sm" />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{
                  color: 'var(--color-accent)',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.12em',
                  fontWeight: 500,
                }}
              >
                {displayCuisine(r.cuisine)}
              </p>
              <h3
                className="text-lg truncate"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 500,
                }}
              >
                {r.name}
              </h3>
              {rating && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Star className="h-4 w-4 fill-current" style={{ color: 'var(--color-primary)' }} />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                  >
                    {rating}
                  </span>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
