import { RestaurantCardHeroSkeleton } from '@/components/LoadingSkeleton'

/**
 * Route-level loading skeleton for /explore.
 * Search bar + category chips + trending strip + hero-card grid. The grid
 * container width + columns + gap mirror the real explore grid
 * (max-w-7xl, 1/2/3/4 cols, gap-5) and use the canonical hero-card
 * skeleton (CD9) so cards don't shift on hydration. The page wrapper
 * inherits the cream --color-background from <body> — no white flash.
 */
export default function ExploreLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <div className="animate-shimmer h-12 rounded-xl max-w-2xl mb-6" />
      <div className="flex flex-wrap gap-2 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-8 rounded-full w-20" />
        ))}
      </div>
      <div className="animate-shimmer h-6 rounded w-44 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <RestaurantCardHeroSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
