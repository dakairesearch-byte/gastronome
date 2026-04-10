import Link from 'next/link'
import RatingBadge from './RatingBadge'
import { Restaurant } from '@/types/database'
import { MapPin, UtensilsCrossed } from 'lucide-react'

interface RestaurantCardProps {
  restaurant: Restaurant
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const priceDisplay = '$'.repeat(restaurant.price_range)
  const avgRating = restaurant.avg_rating || 0

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group h-full">
        {/* Photo placeholder with gradient */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
          <UtensilsCrossed size={28} className="text-emerald-300" />
          {/* Cuisine badge */}
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-700 shadow-sm">
            {restaurant.cuisine}
          </span>
          {/* Rating badge */}
          {avgRating > 0 && (
            <div className="absolute top-3 right-3">
              <RatingBadge rating={avgRating} size="sm" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{restaurant.city}</span>
            <span className="text-gray-300">&middot;</span>
            <span className="text-gray-500">{priceDisplay}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>
    </Link>
  )
}
