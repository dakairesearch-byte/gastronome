'use client'

/**
 * RailCard — the card used across all four home rails (visual treatment
 * mirrors SuggestionCard). Adds:
 *   - data-rail-card attribute so RailImpressionTracker can find it
 *   - onClick handler to fire logFeedEvent('click') + recordPositiveEvent
 *   - No-score honest treatment for scoreless rows ("New to Gastronome — no score yet")
 *   - tasteHint forwarded to BookmarkButton so saves update the taste vector
 */

import Link from 'next/link'
import { useState } from 'react'
import {
  displayCuisine,
  fallbackPhotoForCuisine,
  getRestaurantPhotoUrl,
} from '@/lib/restaurant'
import { ScorePill } from '@/components/GastronomeScoreBadge'
import AccoladesBadges from '@/components/AccoladesBadges'
import BookmarkButton from '@/components/BookmarkButton'
import { gastronomeScore } from '@/lib/score'
import { logFeedEvent } from '@/lib/impressions'
import { recordPositiveEvent } from '@/lib/taste'
import type { Restaurant } from '@/types/database'

interface RailCardProps {
  restaurant: Restaurant
  /** The rail's surface key, e.g. "trending", "city-best", etc. */
  surface: string
  /** 0-based position in the rail (for impression weighting). */
  position: number
  /** When true the card shows the honest no-score treatment. */
  scoreless?: boolean
}

export default function RailCard({ restaurant, surface, position, scoreless = false }: RailCardProps) {
  const [src, setSrc] = useState(() => getRestaurantPhotoUrl(restaurant))
  const [didFallback, setDidFallback] = useState(false)

  const score = gastronomeScore(restaurant)
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.michelin_designation ||
    restaurant.james_beard_winner ||
    restaurant.eater_38
  const reviewCount =
    restaurant.google_review_count ?? restaurant.yelp_review_count ?? null

  function handleClick() {
    logFeedEvent({ surface, position, restaurantId: restaurant.id, event: 'click' })
    recordPositiveEvent({
      cuisine: restaurant.cuisine,
      city: restaurant.city,
      price_range: restaurant.price_range,
      michelin_stars: restaurant.michelin_stars,
    })
  }

  return (
    <div
      data-rail-card
      className="group block rounded-sm shadow-md overflow-hidden transition-all hover:shadow-2xl cursor-pointer relative"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <Link
        href={`/restaurants/${restaurant.id}`}
        className="block"
        onClick={handleClick}
        aria-label={restaurant.name}
      >
        <div className="overflow-hidden relative rounded-t-sm aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${restaurant.name} — ${restaurant.cuisine ?? 'restaurant'}`}
            loading="lazy"
            onError={() => {
              if (didFallback) return
              setDidFallback(true)
              setSrc(fallbackPhotoForCuisine(restaurant.cuisine))
            }}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
          />
        </div>
        <div className="p-4">
          <p
            className="text-xs uppercase tracking-widest mb-1.5"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.12em',
              fontWeight: 500,
            }}
          >
            {displayCuisine(restaurant.cuisine)}
          </p>
          <h3
            className="text-base mb-2 line-clamp-2"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
            }}
          >
            {restaurant.name}
          </h3>
          {hasAccolades && (
            <div className="mb-2.5 pointer-events-none">
              <AccoladesBadges restaurant={restaurant} maxBadges={2} />
            </div>
          )}
          <div
            className="flex items-center justify-between pt-3 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {/* Honest no-score treatment for scoreless/thin rows — imputed
                quality is NEVER displayed here. */}
            {scoreless || !score ? (
              <span
                className="text-xs italic"
                style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
              >
                New to Gastronome — no score yet
              </span>
            ) : (
              <ScorePill score={score.score} size="sm" />
            )}
            {!scoreless && reviewCount != null && (
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
              >
                {reviewCount.toLocaleString()} reviews
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Bookmark button — save-event analytics (logFeedEvent('save')) are
          owned by BookmarkButton when wired; we forward tasteHint so a save
          updates the device taste vector via recordPositiveEvent. */}
      <div className="absolute top-2 right-2 z-[2]">
        <BookmarkButton
          restaurantId={restaurant.id}
          variant="card"
          tasteHint={{
            cuisine: restaurant.cuisine,
            city: restaurant.city,
            price_range: restaurant.price_range,
            michelin_stars: restaurant.michelin_stars,
          }}
        />
      </div>
    </div>
  )
}
