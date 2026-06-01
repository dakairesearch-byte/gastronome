/**
 * Discover route loading skeleton.
 *
 * Mirrors the /discover first paint — a search input shimmer, a quick-chip
 * row of pills, a results bar, and a card grid — so cold loads and route
 * transitions show real structure instead of a blank screen. Neutral tokens
 * only; no colored hero.
 */
export default function DiscoverLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Heading */}
        <div className="mb-6">
          <div className="animate-shimmer h-9 w-48 rounded-lg mb-2" />
          <div className="animate-shimmer h-4 w-80 max-w-full rounded" />
        </div>

        {/* Search input */}
        <div className="animate-shimmer h-12 rounded-xl max-w-2xl mb-4" />

        {/* Quick-chip row */}
        <div className="flex items-center gap-2 mb-5 overflow-hidden">
          {[28, 20, 24, 22, 26].map((w, i) => (
            <div
              key={i}
              className="animate-shimmer h-9 rounded-full flex-shrink-0"
              style={{ width: `${w * 4}px` }}
            />
          ))}
        </div>

        {/* Results bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="animate-shimmer h-4 w-40 rounded" />
          <div className="animate-shimmer h-8 w-32 rounded-lg" />
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="animate-shimmer h-40 w-full" />
              <div className="p-4 space-y-2">
                <div className="animate-shimmer h-4 w-3/4 rounded" />
                <div className="animate-shimmer h-3 w-1/2 rounded" />
                <div className="animate-shimmer h-2.5 w-full rounded mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
