import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'

/**
 * Route-level loading skeleton for /cities/[slug].
 * Header band + filter chips + restaurant card grid.
 */
export default function CityDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="animate-shimmer h-4 rounded w-40 mb-6" />
      <div className="space-y-3 mb-6">
        <div className="animate-shimmer h-9 rounded w-64" />
        <div className="animate-shimmer h-4 rounded w-80" />
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-8 rounded-full w-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
