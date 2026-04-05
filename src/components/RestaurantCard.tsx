import Link from 'next/link'
import StarRating from './StarRating'
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
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md border border-amber-50 cursor-pointer transition-all group overflow-hidden">
        <div className="p-4 sm:p-6 space-y-3">
          {/* Restaurant Name and Details */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 group-hover:text-amber-600 transition-colors">
                {restaurant.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <span className="inline-block px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-gray-500" />
                  {restaurant.city}
                </span>
              </div>
            </div>
          </div>

          {/* Rating and Reviews */}
          <div className="flex items-center gap-3 py-2 border-t border-b border-gray-100">
            <StarRating rating={Math.round(avgRating)} size={16} readonly />
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-gray-900">
                {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
              </span>
              <span className="text-sm text-gray-500">
                {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-lg font-bold text-amber-600 font-mono">
              {priceDisplay}
            </span>
            <span className="text-xs text-gray-500 group-hover:text-amber-600 transition-colors font-medium">
              View details â
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
