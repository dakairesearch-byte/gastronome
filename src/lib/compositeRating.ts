import type { Restaurant } from '@/types/database'

export function getCompositeRating(
  restaurant: Restaurant
): { rating: number; sourceCount: number } | null {
  const ratings: number[] = []

  if (restaurant.google_rating != null) ratings.push(restaurant.google_rating)
  if (restaurant.yelp_rating != null) ratings.push(restaurant.yelp_rating)
  // Normalize Infatuation from 10-point to 5-point scale
  if (restaurant.infatuation_rating != null)
    ratings.push(restaurant.infatuation_rating / 2)

  if (ratings.length === 0) return null

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
  return { rating: Math.round(avg * 100) / 100, sourceCount: ratings.length }
}
