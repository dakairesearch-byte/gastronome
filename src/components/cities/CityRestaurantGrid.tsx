'use client'

import { useState } from 'react'
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
 * Paginated city restaurant grid. The city page previously rendered all
 * (up to 500) restaurants at once — on mobile that produced a
 * ~126,000px-tall page that was a performance and UX crisis (sweep v2
 * P0 #18). We now render PAGE_SIZE at a time and reveal more on demand,
 * which keeps the DOM small without needing a round-trip (the rows are
 * already fetched server-side).
 */
export default function CityRestaurantGrid({
  restaurants,
  cityName,
}: {
  restaurants: CityGridRestaurant[]
  cityName: string
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const shown = restaurants.slice(0, visible)
  const remaining = restaurants.length - visible

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

      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-6 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
          >
            Show {Math.min(PAGE_SIZE, remaining)} more
            <span className="text-gray-400 font-normal">
              {' '}
              ({remaining.toLocaleString()} left)
            </span>
          </button>
        </div>
      )}
    </>
  )
}
