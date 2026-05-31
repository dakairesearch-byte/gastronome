/**
 * Shared restaurant display helpers. These centralize the photo-fallback
 * and cuisine-label rules that were previously inlined across 8+ files.
 */

import type { Restaurant } from '@/types/database'

const GENERIC_PHOTO_FALLBACK =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'

/**
 * Cuisine-keyed Unsplash food photo fallbacks. When a restaurant has no
 * photo on file, we render an appetizing stock shot keyed by cuisine
 * family rather than a gray placeholder. Keys are lowercase and trimmed.
 */
const CUISINE_PHOTO_FALLBACK: Record<string, string> = {
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
  // Use a distinct Thai dish photo (pad thai) instead of repeating the
  // ramen-bowl URL used for ramen/japanese. Sweep v2 food-photography QW.
  thai: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80',
  indian: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
  brunch: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
  dessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80',
  cajun: 'https://images.unsplash.com/photo-1432139509613-5c4255815697?w=800&q=80',
  korean: 'https://images.unsplash.com/photo-1583224994076-ae3c2c8d5c4e?w=800&q=80',
  vietnamese: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80',
  mediterranean: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
  american: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
}

export function fallbackPhotoForCuisine(cuisine: string | null | undefined): string {
  if (!cuisine) return GENERIC_PHOTO_FALLBACK
  return CUISINE_PHOTO_FALLBACK[cuisine.toLowerCase().trim()] ?? GENERIC_PHOTO_FALLBACK
}

type PhotoFields = Pick<
  Restaurant,
  'photo_url' | 'google_photo_url' | 'yelp_photo_url' | 'cuisine'
>

/**
 * Resolve the best available photo for a restaurant, falling back through
 * uploaded photo → Google photo → Yelp photo → cuisine-keyed stock photo.
 * Always returns a usable URL; pair with onError for double-defense against
 * 404s/403s from upstream sources.
 */
export function getRestaurantPhotoUrl(restaurant: PhotoFields): string {
  return (
    restaurant.photo_url ||
    restaurant.google_photo_url ||
    restaurant.yelp_photo_url ||
    fallbackPhotoForCuisine(restaurant.cuisine)
  )
}

/**
 * Whether `url` came from the cuisine-keyed Unsplash stock-photo pool
 * rather than a real first-party photo. Components can use this to
 * dim/badge the image so users aren't misled into thinking the photo
 * is of the actual restaurant. Sweep v2 food-photography QW.
 */
export function isStockFallbackPhoto(url: string | null | undefined): boolean {
  if (!url) return false
  return Object.values(CUISINE_PHOTO_FALLBACK).includes(url) ||
    url === GENERIC_PHOTO_FALLBACK
}

/**
 * Display-friendly cuisine label. The DB has a junk "Restaurant" sentinel
 * for rows where cuisine wasn't classified; surface it as the same word
 * but treat null/empty the same way so the UI never says "null" or shows
 * an empty pill.
 */
export function displayCuisine(cuisine: string | null | undefined): string {
  if (cuisine && cuisine !== 'Restaurant') return cuisine
  return 'Restaurant'
}

/**
 * Slugify a city name to match the convention used in the `cities`
 * table (lowercase, spaces/punctuation → hyphens): "New York" →
 * "new-york", "Los Angeles" → "los-angeles". Used for breadcrumb
 * links from the restaurant detail page to the city page without an
 * extra DB round-trip. If a stored slug ever deviates, the city page's
 * own `notFound()` handles it gracefully.
 */
export function citySlug(cityName: string | null | undefined): string {
  if (!cityName) return ''
  return cityName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Whether the restaurant has a meaningful cuisine label (i.e. not the
 * "Restaurant" sentinel and not null/empty). Use this to decide whether
 * to render a cuisine pill at all.
 */
export function hasMeaningfulCuisine(cuisine: string | null | undefined): boolean {
  return !!cuisine && cuisine !== 'Restaurant'
}
