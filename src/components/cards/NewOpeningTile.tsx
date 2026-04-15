import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { Restaurant } from '@/types/database'

interface NewOpeningTileProps {
  restaurant: Restaurant
}

/**
 * Compact tile for Explore's "New Openings" grid. Alphabetically sorted
 * by the page, not by quality. Every new opening gets equal play — no
 * rank chip, no trending signal — matching the brief's intent.
 */
export default function NewOpeningTile({ restaurant }: NewOpeningTileProps) {
  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group flex items-start gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3 hover:border-emerald-400 hover:bg-emerald-50 transition-all"
    >
      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
        <Sparkles size={14} className="text-emerald-600" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
          {restaurant.name}
        </h3>
        <p className="text-[11px] text-gray-500 truncate">
          {restaurant.cuisine && restaurant.cuisine !== 'Restaurant'
            ? restaurant.cuisine
            : 'Restaurant'}
          {restaurant.neighborhood ? ` • ${restaurant.neighborhood}` : ''}
        </p>
      </div>
    </Link>
  )
}
