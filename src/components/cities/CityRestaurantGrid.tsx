'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AccoladesBadges from '@/components/AccoladesBadges'
import type { Restaurant } from '@/types/database'

/**
 * Restaurant row passed from the city page. We attach `trendingRank`
 * server-side (the trending Map doesn't serialize cleanly across the
 * server/client boundary) so the client grid stays a plain prop.
 */
export type CityGridRestaurant = Restaurant & { trendingRank?: number | null }

const PAGE_SIZE = 24

/**
 * City restaurant grid with scroll-triggered infinite loading. The page
 * previously rendered all (up to 500) restaurants at once — on mobile a
 * ~126,000px-tall page (sweep v2 P0 #18). We render PAGE_SIZE rows and
 * reveal the next page automatically as a sentinel scrolls into view
 * (IntersectionObserver), so it loads in smoothly with no "Load more"
 * button. Rows are already fetched server-side, so growing the window
 * is instant — no round-trip.
 */
export default function CityRestaurantGrid({
  restaurants,
  cityName,
}: {
  restaurants: CityGridRestaurant[]
  cityName: string
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const shown = restaurants.slice(0, visible)
  const hasMore = visible < restaurants.length

  useEffect(() => {
    if (!hasMore) return
    const node = sentinelRef.current
    if (!node) return
    // rootMargin pre-loads the next page ~600px before the sentinel is
    // actually on screen, so rows are already there by the time the
    // user reaches them — no visible "pop".
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => Math.min(v + PAGE_SIZE, restaurants.length))
        }
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, restaurants.length])

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((r) => (
          <Link
            key={r.id}
            href={`/restaurants/${r.id}`}
            className="group block rounded-xl border border-gray-100 bg-white p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
              {r.name}
            </h3>
            <p className="mt-1 text-xs text-gray-500 truncate">
              {r.cuisine && r.cuisine !== 'Restaurant' ? r.cuisine : 'Restaurant'}
              {r.neighborhood ? ` • ${r.neighborhood}` : ''}
            </p>
            {r.trendingRank ? (
              <p className="mt-2 text-[11px] font-semibold text-orange-600">
                🔥 #{r.trendingRank} trending in {cityName}
              </p>
            ) : null}
            <div className="mt-2">
              <AccoladesBadges restaurant={r} maxBadges={3} />
            </div>
          </Link>
        ))}
      </div>

      {/* Screen-reader progress + auto-load sentinel. The sentinel is
          what the IntersectionObserver watches; the aria-live text keeps
          non-visual users informed since there's no button to announce. */}
      <p className="sr-only" aria-live="polite">
        Showing {shown.length} of {restaurants.length} restaurants.
      </p>
      {hasMore && (
        <div
          ref={sentinelRef}
          aria-hidden="true"
          className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Skeleton placeholders hint that more is loading as the user
              approaches the end. */}
          {Array.from({ length: Math.min(3, restaurants.length - visible) }).map((_, i) => (
            <div key={i} className="animate-shimmer h-28 rounded-xl" />
          ))}
        </div>
      )}
    </>
  )
}
