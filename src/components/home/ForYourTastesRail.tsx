'use client'

/**
 * Rail 3 — "For your tastes"
 *
 * Client component: taste affinity is read from localStorage (device-local
 * taste vector). Props from the server; re-ranks after mount using
 * getTasteAffinity so the initial server/client HTML matches (cold-start
 * fallback) and then upgrades to personalized on first effect.
 *
 * For signed-out / no-signal users: the 70/20/10 day-0 interleaved list
 * is passed in as `fallbackRestaurants` and shown with honest copy.
 *
 * Objective copy (personalized): "Picked for your taste in cuisine and dining style"
 * Objective copy (cold start):   "Highly rated in your city, curated for a first visit"
 *
 * SSR hydration safety: initial state always uses the fallback list so the
 * server-rendered HTML and the first client render are identical. The
 * useEffect upgrades to personalized without a hydration mismatch.
 */

import { useState, useEffect } from 'react'
import SectionHeader from '@/components/SectionHeader'
import RailCard from './RailCard'
import RailImpressionTracker from './RailImpressionTracker'
import { getTasteAffinity } from '@/lib/taste'
import { mmrDiversify } from '@/lib/ranking/explore'
import type { Restaurant } from '@/types/database'

interface ForYourTastesRailProps {
  /** Candidate pool — city restaurants with a gastronomeScore. Re-ranked client-side. */
  candidates: Restaurant[]
  /**
   * Day-0 interleaved fallback (70% city-best, 20% taste-matched, 10% explore),
   * pre-built server-side. Used until a taste signal is detected.
   */
  fallbackRestaurants: Restaurant[]
  /** Resolved city name for display. */
  city: string
  /** Pre-computed gastronome scores keyed by restaurant id. */
  scores: Record<string, number>
}

function tasteKey(r: Restaurant) {
  return {
    cuisine: r.cuisine,
    city: r.city,
    price_range: r.price_range,
    michelin_stars: r.michelin_stars,
  }
}

function buildPersonalizedRanking(
  candidates: Restaurant[],
  scores: Record<string, number>,
): { ranked: Restaurant[]; isPersonalized: boolean } {
  if (candidates.length === 0) {
    return { ranked: [], isPersonalized: false }
  }

  // Cold-start detection: an empty taste vector yields the SAME affinity for
  // every candidate (dot product is 0 for all of them, so the formula
  // 0.85 + 0.30·sigmoid(−SHIFT) gives one constant — NOT 1.0; 1.0 is the
  // SSR-only neutral). A uniform multiplier cannot change the ranking, so
  // if all affinities are equal there is no usable taste signal — keep the
  // honest day-0 fallback instead of claiming personalization.
  const firstAffinity = getTasteAffinity(tasteKey(candidates[0]))
  const allNeutral = candidates.every(
    (r) => getTasteAffinity(tasteKey(r)) === firstAffinity,
  )
  if (allNeutral) {
    return { ranked: [], isPersonalized: false }
  }

  const sorted = [...candidates].sort((a, b) => {
    const qa = (scores[a.id] ?? 0) * getTasteAffinity(tasteKey(a))
    const qb = (scores[b.id] ?? 0) * getTasteAffinity(tasteKey(b))
    return qb - qa
  })

  const pool = sorted.slice(0, 24)
  const diversified = mmrDiversify(
    pool,
    (r) => (scores[r.id] ?? 0) * getTasteAffinity(tasteKey(r)),
  )
  return { ranked: diversified.slice(0, 8), isPersonalized: true }
}

export default function ForYourTastesRail({
  candidates,
  fallbackRestaurants,
  city,
  scores,
}: ForYourTastesRailProps) {
  // Initial state always matches the server render (cold-start fallback).
  const [ranked, setRanked] = useState<Restaurant[]>(fallbackRestaurants.slice(0, 8))
  const [isPersonalized, setIsPersonalized] = useState(false)

  // After mount, check for a taste signal and upgrade to personalized if found.
  useEffect(() => {
    const { ranked: personalRanked, isPersonalized: personal } =
      buildPersonalizedRanking(candidates, scores)
    if (personal && personalRanked.length > 0) {
      setRanked(personalRanked)
      setIsPersonalized(true)
    }
    // If no taste signal, keep showing the fallback list.
  }, [candidates, scores])

  if (ranked.length === 0) return null

  const objective = isPersonalized
    ? 'Picked for your taste in cuisine and dining style'
    : 'Highly rated in your city, curated for a first visit'

  return (
    <section className="mb-16">
      <SectionHeader
        label="For your tastes"
        title={isPersonalized ? 'Tailored for you' : `Top picks in ${city}`}
      />
      {/* Plain-English objective — transparent rail, honest about personalization state */}
      <p
        className="text-sm -mt-3 mb-5"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        {objective}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {ranked.map((r, i) => (
          <RailCard
            key={r.id}
            restaurant={r}
            surface="for-your-tastes"
            position={i}
          />
        ))}
      </div>
      <RailImpressionTracker
        surface="for-your-tastes"
        restaurantIds={ranked.map((r) => r.id)}
      />
    </section>
  )
}
