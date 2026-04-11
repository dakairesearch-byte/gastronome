import Link from 'next/link'
import { Restaurant } from '@/types/database'
import { MapPin, UtensilsCrossed, Star, Video } from 'lucide-react'
import SourceRatingsBar from './SourceRatingsBar'

interface RestaurantCardProps {
  restaurant: Restaurant
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const priceDisplay = '$'.repeat(restaurant.price_range || 1)

  // Determine the best accolade to show as a badge
  const topAccolade = getTopAccolade(restaurant)

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group h-full">
        {/* Photo */}
        <div className="relative aspect-[16/10] bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center overflow-hidden">
          {restaurant.photo_url ? (
            <img
              src={restaurant.photo_url}
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <UtensilsCrossed size={32} className="text-emerald-300" />
          )}
          {/* Accolade Badge */}
          {topAccolade && (
            <div className="absolute top-2.5 right-2.5 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1">
              <span>{topAccolade.icon}</span>
              <span className="text-gray-800">{topAccolade.label}</span>
            </div>
          )}
          {/* Cuisine badge */}
          {restaurant.cuisine && (
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-700 shadow-sm">
              {restaurant.cuisine}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{restaurant.neighborhood || restaurant.city}</span>
            <span className="text-gray-300">&middot;</span>
            <span>{priceDisplay}</span>
          </div>

          {/* Source Ratings */}
          <div className="mt-3">
            <SourceRatingsBar restaurant={restaurant} compact />
          </div>
        </div>
      </div>
    </Link>
  )
}

function getTopAccolade(restaurant: Restaurant): { icon: string; label: string } | null {
  if (restaurant.michelin_stars >= 3) return { icon: '\u2B50', label: '3 Stars' }
  if (restaurant.michelin_stars === 2) return { icon: '\u2B50', label: '2 Stars' }
  if (restaurant.michelin_stars === 1) return { icon: '\u2B50', label: '1 Star' }
  if (restaurant.michelin_designation === 'bib_gourmand') return { icon: '\uD83C\uDF7D\uFE0F', label: 'Bib Gourmand' }
  if (restaurant.james_beard_winner) return { icon: '\uD83C\uDFC6', label: 'James Beard' }
  if (restaurant.eater_38) return { icon: '\uD83D\uDD25', label: 'Eater 38' }
  return null
}
