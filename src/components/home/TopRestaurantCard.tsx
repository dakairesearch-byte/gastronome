import Link from 'next/link'
import SourceRatingsBar from '@/components/SourceRatingsBar'
import AccoladesBadges from '@/components/AccoladesBadges'
import { getCompositeRating } from '@/lib/compositeRating'
import { MapPin } from 'lucide-react'
import type { Restaurant } from '@/types/database'

interface TopRestaurantCardProps {
  restaurant: Restaurant
  rank: number
}

export default function TopRestaurantCard({
  restaurant,
  rank,
}: TopRestaurantCardProps) {
  const priceDisplay = '$'.repeat(restaurant.price_range || 1)
  const composite = getCompositeRating(restaurant)
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.james_beard_nominated ||
    restaurant.eater_38

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="group flex gap-4 bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
        {/* Rank */}
        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
          <span className="text-lg sm:text-xl font-extrabold text-emerald-600">
            {rank}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors line-clamp-1 min-w-0">
                {restaurant.name}
              </h3>
              {composite && (
                <span className="flex-shrink-0 text-lg font-extrabold text-emerald-600">
                  {composite.rating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={12} />
                {restaurant.neighborhood || restaurant.city}
              </span>
              <span className="text-xs font-bold text-emerald-600 font-mono">
                {priceDisplay}
              </span>
            </div>
          </div>

          {hasAccolades && (
            <AccoladesBadges restaurant={restaurant} maxBadges={2} />
          )}

          <SourceRatingsBar restaurant={restaurant} compact />
        </div>
      </div>
    </Link>
  )
}
