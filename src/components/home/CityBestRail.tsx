/**
 * Rail 2 — "Best of {city}"
 *
 * Objective copy: "Highest-rated by cross-source consensus"
 *
 * Shows restaurants sorted by Gastronome Score where sourceCount >= 2.
 * MMR diversify applied (skipping cuisine term only when the user filtered
 * by cuisine, which doesn't apply on home).
 */

import SectionHeader from '@/components/SectionHeader'
import RailCard from './RailCard'
import RailImpressionTracker from './RailImpressionTracker'
import type { Restaurant } from '@/types/database'

interface CityBestRailProps {
  restaurants: Restaurant[]
  city: string
}

export default function CityBestRail({ restaurants, city }: CityBestRailProps) {
  if (restaurants.length === 0) return null

  return (
    <section className="mb-16">
      <SectionHeader
        label="Best of the city"
        title={`Best of ${city}`}
      />
      {/* Plain-English objective — transparent rail */}
      <p
        className="text-sm -mt-3 mb-5"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        Highest-rated by cross-source consensus
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {restaurants.map((r, i) => (
          <RailCard
            key={r.id}
            restaurant={r}
            surface="city-best"
            position={i}
          />
        ))}
      </div>
      <RailImpressionTracker
        surface="city-best"
        restaurantIds={restaurants.map((r) => r.id)}
      />
    </section>
  )
}
