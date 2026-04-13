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
  rank?: number
  showRank?: boolean
}

function getBorderAccent(restaurant: Restaurant): string {
  if (restaurant.michelin_stars > 0 || restaurant.michelin_designation) return 'border-l-4 border-l-red-400'
  if (restaurant.james_beard_winner || restaurant.james_beard_nominated) return 'border-l-4 border-l-amber-400'
  if (restaurant.eater_38) return 'border-l-4 border-l-pink-400'
  return ''
}

function getRankBadgeStyles(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white ring-2 ring-amber-200'
  if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-white ring-2 ring-gray-200'
  if (rank === 3) return 'bg-gradient-to-br from-amber-600 to-orange-700 text-white ring-2 ring-orange-200'
  if (rank <= 10) return 'bg-emerald-600 text-white'
  return 'bg-gray-400 text-white'
}

export default function RestaurantCard({ restaurant, trendingTier, rank, showRank }: RestaurantCardProps) {
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.james_beard_nominated ||
    restaurant.eater_38

  const borderAccent = getBorderAccent(restaurant)

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className={`rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-100 overflow-hidden bg-white cursor-pointer group ${borderAccent}`}>
        <div className="p-4 sm:p-5 space-y-2.5">
          {/* Restaurant Name with optional rank badge */}
          <div>
            <div className="flex items-center gap-2.5">
              {showRank && rank != null && (
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center ${getRankBadgeStyles(rank)}`}
                >
                  {rank}
                </span>
              )}
              <h3 className="font-bold text-gray-900 text-lg line-clamp-1 min-w-0 group-hover:text-emerald-600 transition-colors">
                {restaurant.name}
              </h3>
            </div>
            <div className={`flex items-center gap-2 mt-1 flex-wrap ${showRank && rank != null ? 'ml-[38px]' : ''}`}>
              {trendingTier && trendingTier !== 'none' && (
                <TrendingBadge tier={trendingTier} />
              )}
              {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={14} />
                {restaurant.city}
                {restaurant.neighborhood && (
                  <span className="text-gray-400">&middot; {restaurant.neighborhood}</span>
                )}
              </span>
            </div>
          </div>

          {/* Accolade badges — own row below name */}
          {hasAccolades && (
            <div className={showRank && rank != null ? 'ml-[38px]' : ''}>
              <AccoladesBadges restaurant={restaurant} maxBadges={3} />
            </div>
          )}

          {/* Source Ratings Bar */}
          <div className={showRank && rank != null ? 'ml-[38px]' : ''}>
            <SourceRatingsBar restaurant={restaurant} />
          </div>
        </div>
      </div>
    </Link>
  )
}
