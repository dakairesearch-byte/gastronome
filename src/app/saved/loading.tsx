import { RestaurantCardCompactSkeleton } from '@/components/LoadingSkeleton'

/**
 * Route-level loading skeleton for /saved.
 *
 * Mirrors the real page chrome: a title/subtitle block over a responsive
 * 1/2/3-column grid of canonical compact-card skeletons so nothing
 * shifts when the client component hydrates and reads localStorage. The
 * wrapper inherits the cream --color-background from <body>, so there's
 * no white flash. The page itself also renders this same grid while it
 * fetches restaurant rows for the saved ids.
 */
export default function SavedLoading() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="animate-shimmer h-9 rounded w-40 mb-3" />
          <div className="animate-shimmer h-4 rounded w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <RestaurantCardCompactSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
