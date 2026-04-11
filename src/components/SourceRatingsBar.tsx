import type { Restaurant, SourceRating } from '@/types/database'
import SourceBadge from './SourceBadge'

export function getSourceRatings(restaurant: Restaurant): SourceRating[] {
  const ratings: SourceRating[] = []

  if (restaurant.google_rating != null) {
    ratings.push({
      source: 'google',
      rating: restaurant.google_rating,
      reviewCount: restaurant.google_review_count ?? undefined,
      url: restaurant.google_url,
      maxRating: 5,
      color: 'blue',
      label: 'Google',
      icon: 'G',
    })
  }

  if (restaurant.yelp_rating != null) {
    ratings.push({
      source: 'yelp',
      rating: restaurant.yelp_rating,
      reviewCount: restaurant.yelp_review_count ?? undefined,
      url: restaurant.yelp_url,
      maxRating: 5,
      color: 'red',
      label: 'Yelp',
      icon: 'Y',
    })
  }

  if (restaurant.beli_score != null) {
    ratings.push({
      source: 'beli',
      rating: restaurant.beli_score,
      reviewCount: undefined,
      url: restaurant.beli_url,
      maxRating: 100,
      color: 'purple',
      label: 'Beli',
      icon: 'B',
    })
  }

  if (restaurant.infatuation_rating != null) {
    ratings.push({
      source: 'infatuation',
      rating: restaurant.infatuation_rating,
      reviewCount: undefined,
      url: restaurant.infatuation_url,
      maxRating: 10,
      color: 'orange',
      label: 'The Infatuation',
      icon: 'TI',
    })
  }

  return ratings
}

interface SourceRatingsBarProps {
  restaurant: Restaurant
  compact?: boolean
}

export default function SourceRatingsBar({ restaurant, compact = false }: SourceRatingsBarProps) {
  const ratings = getSourceRatings(restaurant)

  if (ratings.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {ratings.map((source) => (
        <SourceBadge key={source.source} source={source} compact={compact} />
      ))}
    </div>
  )
}
