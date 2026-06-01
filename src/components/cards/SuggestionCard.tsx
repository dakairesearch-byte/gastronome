'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  displayCuisine,
  fallbackPhotoForCuisine,
  getRestaurantPhotoUrl,
} from '@/lib/restaurant'
import { ScorePill } from '@/components/GastronomeScoreBadge'
import AccoladesBadges from '@/components/AccoladesBadges'
import { gastronomeScore } from '@/lib/score'
import type { Restaurant } from '@/types/database'

interface SuggestionCardProps {
  restaurant: Restaurant
}

/**
 * Home "Suggestions" card: photo + cuisine label + name + accolade pills +
 * the Gastronome Score as the lead metric. Previously this card carried a
 * single-source Google/Yelp star — the weakest scent of any card. It now
 * mirrors the canonical RestaurantCard hierarchy (name → accolades → meta →
 * Gastronome Score) while keeping the home rail's square-photo, token-styled
 * look. Exported prop API is unchanged so page.tsx needs no edit.
 */
export default function SuggestionCard({ restaurant }: SuggestionCardProps) {
  // If the primary photo 404s or 403s we swap once to the cuisine fallback
  // rather than dumping a broken-image icon on the Home page.
  const [src, setSrc] = useState(() => getRestaurantPhotoUrl(restaurant))
  const [didFallback, setDidFallback] = useState(false)

  // The Gastronome Score is the namesake unified metric — a credibility-
  // weighted blend across every rating source. It replaces the lone
  // single-source star as the card's lead number. `gastronomeScore` returns
  // null when the restaurant has no rating source at all; ScorePill renders
  // nothing in that case so we show a quiet "No rating yet" fallback instead.
  const score = gastronomeScore(restaurant)
  const reviewCount = restaurant.google_review_count ?? restaurant.yelp_review_count ?? null
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.michelin_designation ||
    restaurant.james_beard_winner ||
    restaurant.eater_38

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block rounded-sm shadow-md overflow-hidden transition-all hover:shadow-2xl cursor-pointer"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="overflow-hidden relative rounded-sm aspect-square">
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
          className="text-base mb-2"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
          }}
        >
          {restaurant.name}
        </h3>
        {hasAccolades && (
          <div className="mb-2.5">
            <AccoladesBadges restaurant={restaurant} maxBadges={2} />
          </div>
        )}
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {score ? (
            <ScorePill score={score.score} size="sm" />
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              No rating yet
            </span>
          )}
          {reviewCount != null && (
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
  )
}
