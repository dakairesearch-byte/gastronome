import Link from 'next/link'
import RatingBadge from './RatingBadge'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

interface RestaurantCardProps {
  restaurant: Restaurant
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const priceDisplay = '$'.repeat(restaurant.price_range)
  const avgRating = restaurant.avg_rating || 0

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="bg-white rounded-lg border border-gray-100 p-4 transition-all duration-150 hover:shadow-md group">
        <div className="flex items-start gap-3">
          {/* Rating badge */}
          <RatingBadge rating={avgRating} size="md" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-emerald-600 transition-colors">
              {restaurant.name}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {restaurant.cuisine} &middot; {priceDisplay} &middot;{' '}
              <span className="inline-flex items-center gap-0.5">
                <MapPin size={12} className="text-gray-400" />
                {restaurant.city}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
