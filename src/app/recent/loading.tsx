/**
 * Route-level loading skeleton for /recent.
 * Title + filter chips + a vertical list of day-grouped feed events.
 */
export default function RecentLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="animate-shimmer h-8 rounded w-40 mb-2" />
      <div className="animate-shimmer h-4 rounded w-72 mb-6" />
      <div className="flex flex-wrap gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-8 rounded-full w-20" />
        ))}
      </div>
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, group) => (
          <div key={group} className="space-y-3">
            <div className="animate-shimmer h-4 rounded w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="animate-shimmer h-14 w-14 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="animate-shimmer h-4 rounded w-3/4" />
                  <div className="animate-shimmer h-3 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
