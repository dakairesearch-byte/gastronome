/**
 * Route-level loading skeleton for /cities.
 * Mirrors the city-list grid so the layout doesn't jump when data lands.
 */
export default function CitiesLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-3 mb-8">
        <div className="animate-shimmer h-8 rounded w-48" />
        <div className="animate-shimmer h-4 rounded w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="animate-shimmer h-40" />
            <div className="p-4 space-y-3">
              <div className="animate-shimmer h-5 rounded w-2/3" />
              <div className="animate-shimmer h-3 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
