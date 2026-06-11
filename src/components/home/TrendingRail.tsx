/**
 * Rail 1 — "Trending this week"
 *
 * Objective copy: "What people are talking about right now"
 *
 * Uses topTrendingRestaurants (existing lib, untouched). No MMR on this
 * rail per spec — trending is its own diversity signal. Impression tracking
 * is handled by RailImpressionTracker (client island).
 */

import SectionHeader from '@/components/SectionHeader'
import RailCard from './RailCard'
import RailImpressionTracker from './RailImpressionTracker'
import type { Restaurant } from '@/types/database'

interface TrendingRailProps {
  restaurants: Restaurant[]
  city: string
}

export default function TrendingRail({ restaurants, city }: TrendingRailProps) {
  if (restaurants.length === 0) return null

  return (
    <section className="mb-16">
      <SectionHeader
        label="Trending this week"
        title={`What's hot in ${city}`}
      />
      {/* Plain-English objective — transparent rail */}
      <p
        className="text-sm -mt-3 mb-5"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        What people are talking about right now
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {restaurants.map((r, i) => (
          <RailCard
            key={r.id}
            restaurant={r}
            surface="trending"
            position={i}
          />
        ))}
      </div>
      <RailImpressionTracker
        surface="trending"
        restaurantIds={restaurants.map((r) => r.id)}
      />
    </section>
  )
}
