import Link from 'next/link'
import { MapPin } from 'lucide-react'
import AccoladesBadges from '@/components/AccoladesBadges'
import type { Restaurant } from '@/types/database'

interface JustAddedCardProps {
  restaurant: Restaurant
}

/**
 * Compact tile used in Home's "Just Added" section. Intentionally flat
 * (no ranking, no score) — the selection rule is recency, not quality,
 * and rendering any rank hint would conflict with the brief's "equal
 * play" intent for new entries.
 */
export default function JustAddedCard({ restaurant }: JustAddedCardProps) {
  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block rounded-xl border border-gray-100 bg-white p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
        {restaurant.name}
      </h3>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
            {restaurant.cuisine}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 truncate">
          <MapPin size={11} className="text-gray-400 flex-shrink-0" />
          {restaurant.city || '—'}
        </span>
      </div>
      <div className="mt-2">
        <AccoladesBadges restaurant={restaurant} maxBadges={3} />
      </div>
    </Link>
  )
}
