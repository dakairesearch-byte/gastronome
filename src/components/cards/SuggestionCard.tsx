'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Star } from 'lucide-react'
import type { Restaurant } from '@/types/database'

interface SuggestionCardProps {
  restaurant: Restaurant
}

/**
 * Cuisine → Unsplash food photo fallback keyed by cuisine family. When a
 * restaurant has no photo in Supabase we show an appetizing stock shot
 * instead of a gray box with an initial, which tested as demoralising
 * on the Home page (roughly 40% of cards had no photo).
 */
const CUISINE_FALLBACK: Record<string, string> = {
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
  'fine dining': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  barbecue: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80',
  japanese: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80',
  sushi: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80',
  chinese: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=80',
  ramen: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
  french: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=800&q=80',
  italian: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80',
  mexican: 'https://images.unsplash.com/photo-1565299585323-38174c4a6b55?w=800&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  thai: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
  indian: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
  brunch: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
  dessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
  cajun: 'https://images.unsplash.com/photo-1432139509613-5c4255815697?w=800&q=80',
  korean: 'https://images.unsplash.com/photo-1583224994076-ae3c2c8d5c4e?w=800&q=80',
  vietnamese: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80',
  mediterranean: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
  american: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
}

const GENERIC_FALLBACK =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'

function fallbackFor(cuisine: string | null | undefined): string {
  if (!cuisine) return GENERIC_FALLBACK
  const key = cuisine.toLowerCase().trim()
  return CUISINE_FALLBACK[key] ?? GENERIC_FALLBACK
}

/**
 * Figma "Suggestions" card: photo + cuisine label + name + rating/review count.
 * Replaces TrendingCard on the homepage.
 */
export default function SuggestionCard({ restaurant }: SuggestionCardProps) {
  const photo =
    restaurant.photo_url ||
    restaurant.google_photo_url ||
    restaurant.yelp_photo_url ||
    fallbackFor(restaurant.cuisine)

  // If the primary photo 404s or 403s we swap once to the cuisine fallback
  // rather than dumping a broken-image icon on the Home page.
  const [src, setSrc] = useState(photo)
  const [didFallback, setDidFallback] = useState(false)

  const rating = restaurant.google_rating ?? restaurant.yelp_rating ?? null
  const reviewCount = restaurant.google_review_count ?? restaurant.yelp_review_count ?? null

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block rounded-sm shadow-md overflow-hidden transition-all hover:shadow-2xl cursor-pointer"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="overflow-hidden relative rounded-sm aspect-[3/4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${restaurant.name} — ${restaurant.cuisine ?? 'restaurant'}`}
          loading="lazy"
          onError={() => {
            if (didFallback) return
            setDidFallback(true)
            setSrc(fallbackFor(restaurant.cuisine))
          }}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
        />
      </div>
      <div className="p-5">
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.12em',
            fontWeight: 500,
          }}
        >
          {restaurant.cuisine && restaurant.cuisine !== 'Restaurant'
            ? restaurant.cuisine
            : 'Restaurant'}
        </p>
        <h3
          className="text-xl mb-3"
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
          {rating != null ? (
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
                {rating.toFixed(1)}
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
