'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Star } from 'lucide-react'
import {
  displayCuisine,
  fallbackPhotoForCuisine,
  getRestaurantPhotoUrl,
} from '@/lib/restaurant'
import { formatRating } from '@/lib/format'
import type { Restaurant } from '@/types/database'

interface SuggestionCardProps {
  restaurant: Restaurant
}

/**
 * Figma "Suggestions" card: photo + cuisine label + name + rating/review count.
 * Replaces TrendingCard on the homepage.
 */
export default function SuggestionCard({ restaurant }: SuggestionCardProps) {
  // If the primary photo 404s or 403s we swap once to the cuisine fallback
  // rather than dumping a broken-image icon on the Home page.
  const [src, setSrc] = useState(() => getRestaurantPhotoUrl(restaurant))
  const [didFallback, setDidFallback] = useState(false)

  const rating = restaurant.google_rating ?? restaurant.yelp_rating ?? null
  const reviewCount = restaurant.google_review_count ?? restaurant.yelp_review_count ?? null
  const ratingDisplay = formatRating(rating)

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
          className="text-base mb-2.5"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
          }}
        >
          {restaurant.name}
        </h3>
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {ratingDisplay ? (
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-current" style={{ color: 'var(--color-primary)' }} />
              <span
                className="text-sm"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {ratingDisplay}
              </span>
            </div>
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
