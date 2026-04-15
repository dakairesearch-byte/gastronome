import Link from 'next/link'
import { MapPin } from 'lucide-react'
import TrendingChip from './TrendingChip'
import type { TrendingRestaurant } from '@/lib/ranking/trending'

interface TrendingCardProps {
  restaurant: TrendingRestaurant
  /** Label appended to the chip, e.g. "NYC" or undefined for global. */
  cityScope?: string | null
}

/**
 * Fixed-width card designed to sit inside a horizontal scroll rail on
 * Home's trending sections. Shows photo, name, cuisine, neighborhood,
 * and the single trending chip — NO aggregate star, NO per-source chips,
 * NO rank medal. The ranking signal is exclusively the chip.
 */
export default function TrendingCard({ restaurant, cityScope }: TrendingCardProps) {
  const photo =
    restaurant.photo_url ||
    restaurant.google_photo_url ||
    restaurant.yelp_photo_url ||
    null

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block flex-shrink-0 w-60 sm:w-72 rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-gray-300">
            {restaurant.name.charAt(0)}
          </div>
        )}
        <div className="absolute top-2 left-2">
          <TrendingChip rank={restaurant.trending_rank} city={cityScope ?? undefined} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
          {restaurant.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
              {restaurant.cuisine}
            </span>
          )}
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin size={11} className="text-gray-400 flex-shrink-0" />
            {restaurant.neighborhood || restaurant.city || '—'}
          </span>
        </div>
      </div>
    </Link>
  )
}
