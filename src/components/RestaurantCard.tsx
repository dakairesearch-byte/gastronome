import Link from 'next/link'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import { Restaurant } from '@/types/database'
import { MapPin, Star } from 'lucide-react'

interface RestaurantCardProps {
  restaurant: Restaurant
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const priceDisplay = '$'.repeat(restaurant.price_range || 1)
  const displayRating = restaurant.google_rating || restaurant.avg_rating || 0
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.james_beard_nominated ||
    restaurant.eater_38

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-100 overflow-hidden bg-white cursor-pointer group">
        <div className="p-4 sm:p-5 space-y-3">
          {/* Restaurant Name + Accolades */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 group-hover:text-emerald-600 transition-colors">
                {restaurant.name}
              </h3>
              {hasAccolades && (
                <div className="shrink-0">
                  <AccoladesBadges restaurant={restaurant} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {restaurant.cuisine && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={14} />
                {restaurant.neighborhood || restaurant.city}
              </span>
            </div>
          </div>

          {/* Source Ratings Bar */}
          <div>
            <SourceRatingsBar restaurant={restaurant} />
          </div>

          {/* Rating and Price */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {displayRating > 0 ? (
                <>
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-gray-900">
                    {displayRating.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-400">No ratings yet</span>
              )}
              {restaurant.review_count > 0 && (
                <span className="text-xs text-gray-500">
                  ({restaurant.review_count})
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-emerald-600 font-mono">
              {priceDisplay}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
