import Link from 'next/link'
import { ArrowRight, Flame } from 'lucide-react'
import TrendingCard from '@/components/cards/TrendingCard'
import type { TrendingRestaurant } from '@/lib/ranking/trending'

interface TrendingRailProps {
  title: string
  subtitle?: string
  restaurants: TrendingRestaurant[]
  cityScope?: string | null
  viewAllHref?: string
}

/**
 * Horizontal-scroll rail of TrendingCard tiles. Intentionally NOT a
 * numbered leaderboard — the only ranking visual is the chip on each
 * card. If there's nothing to show the rail collapses (returns null).
 */
export default function TrendingRail({
  title,
  subtitle,
  restaurants,
  cityScope,
  viewAllHref,
}: TrendingRailProps) {
  if (restaurants.length === 0) return null

  return (
    <section>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Flame size={20} className="text-orange-500 flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap mt-1.5"
          >
            View all <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
        <div className="flex items-stretch gap-4 pb-2">
          {restaurants.map((r) => (
            <TrendingCard key={r.id} restaurant={r} cityScope={cityScope} />
          ))}
        </div>
      </div>
    </section>
  )
}
