import Link from 'next/link'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import TrendingBadge from './TrendingBadge'
import { Restaurant } from '@/types/database'
import type { TrendingTier } from '@/lib/placement'
import { MapPin } from 'lucide-react'

interface RestaurantCardProps {
  restaurant: Restaurant
  trendingTier?: TrendingTier
}

export default function RestaurantCard({ restaurant, trendingTier }: RestaurantCardProps) {
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
              {trendingTier && trendingTier !== 'none' && (
                <TrendingBadge tier={trendingTier} />
              )}
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

          {/* Source Ratings Bar — the ONLY rating display */}
          <div>
            <SourceRatingsBar restaurant={restaurant} />
          </div>
        </div>
      </div>
    </Link>
  )
}
