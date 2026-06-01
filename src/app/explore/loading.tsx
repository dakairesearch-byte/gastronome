import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'

/**
 * Route-level loading skeleton for /explore.
 * Search bar + category chips + trending strip + collection/card grid.
 */
export default function ExploreLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="animate-shimmer h-12 rounded-xl max-w-2xl mb-6" />
      <div className="flex flex-wrap gap-2 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-8 rounded-full w-20" />
        ))}
      </div>
      <div className="animate-shimmer h-6 rounded w-44 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
