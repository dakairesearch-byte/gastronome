/**
 * Route-level loading skeleton for /recent.
 * Title + filter chips + a vertical list of day-grouped feed events.
 * Container width + section spacing mirror the real feed (max-w-4xl,
 * space-y-10 sections, space-y-3 rows). The feed renders EventCard rows
 * (not RestaurantCard), so the placeholder mirrors that thumbnail+text
 * row rather than a card skeleton. The wrapper inherits the cream
 * --color-background from <body> — no white flash.
 */
export default function RecentLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="animate-shimmer h-8 rounded w-40 mb-2" />
      <div className="animate-shimmer h-4 rounded w-72 mb-6" />
      <div className="flex flex-wrap gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-shimmer h-8 rounded-full w-20" />
        ))}
      </div>
      <div className="space-y-10">
        {Array.from({ length: 2 }).map((_, group) => (
          <section key={group}>
            <div className="animate-shimmer h-4 rounded w-28 mb-3" />
            <div className="space-y-3">
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
          </section>
        ))}
      </div>
    </div>
  )
}
