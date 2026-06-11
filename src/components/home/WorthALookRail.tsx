/**
 * Rail 4 — "Worth a look"
 *
 * Objective copy: "New and under-the-radar spots"
 *
 * Shows scoreless/thin restaurants ranked by imputeQuality (never displayed),
 * then seededDailyShuffle so the order rotates daily but is stable intra-day.
 * Seed key = (userId or sessionId) + current calendar date string.
 *
 * All cards show the honest no-score treatment ("New to Gastronome — no score yet").
 * MMR diversify applied.
 *
 * This is a SERVER component. It receives pre-computed seed data from the page.
 */

import SectionHeader from '@/components/SectionHeader'
import RailCard from './RailCard'
import RailImpressionTracker from './RailImpressionTracker'
import type { Restaurant } from '@/types/database'

interface WorthALookRailProps {
  restaurants: Restaurant[]
  city: string
}

export default function WorthALookRail({ restaurants, city }: WorthALookRailProps) {
  if (restaurants.length === 0) return null

  return (
    <section className="mb-16">
      <SectionHeader
        label="Worth a look"
        title={`New and under-the-radar in ${city}`}
      />
      {/* Plain-English objective — transparent rail */}
      <p
        className="text-sm -mt-3 mb-5"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        New and under-the-radar spots
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {restaurants.map((r, i) => (
          <RailCard
            key={r.id}
            restaurant={r}
            surface="worth-a-look"
            position={i}
            scoreless
          />
        ))}
      </div>
      <RailImpressionTracker
        surface="worth-a-look"
        restaurantIds={restaurants.map((r) => r.id)}
      />
    </section>
  )
}
