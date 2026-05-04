import Link from 'next/link'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

interface RestaurantCardProps {
  restaurant: Restaurant
}

function getBorderAccent(restaurant: Restaurant): string {
  if (restaurant.michelin_stars > 0 || restaurant.michelin_designation) return 'border-l-4 border-l-red-400'
  if (restaurant.james_beard_winner) return 'border-l-4 border-l-amber-400'
  if (restaurant.eater_38) return 'border-l-4 border-l-pink-400'
  return ''
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.james_beard_winner ||
    restaurant.eater_38

  const borderAccent = getBorderAccent(restaurant)

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className={`rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-100 overflow-hidden bg-white cursor-pointer group ${borderAccent}`}>
        <div className="p-4 sm:p-5 space-y-2.5">
          {/* Restaurant Name */}
          <div>
            <h3 className="font-bold text-gray-900 text-lg line-clamp-1 min-w-0 group-hover:text-emerald-600 transition-colors">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
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
          {hasAccolades && <AccoladesBadges restaurant={restaurant} maxBadges={3} />}

          {/* Source Ratings Bar */}
          <SourceRatingsBar restaurant={restaurant} />
        </div>
      </div>
    </Link>
  )
}
