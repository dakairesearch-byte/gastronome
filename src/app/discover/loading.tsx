/**
 * Discover route loading skeleton (Reformulation v2).
 *
 * Mirrors the new /discover first paint — a title, the persistent global
 * search input, the Browse|Map segmented toggle, and a card grid — so cold
 * loads and route transitions show real structure instead of a blank screen.
 * Neutral tokens only; no colored hero.
 */
export default function DiscoverLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* Heading */}
        <div>
          <div className="animate-shimmer h-9 w-48 rounded-lg mb-2" />
          <div className="animate-shimmer h-4 w-80 max-w-full rounded" />
        </div>

        {/* Persistent search input */}
        <div className="animate-shimmer h-12 rounded-xl max-w-2xl" />

        {/* Browse | Map segmented toggle */}
        <div className="animate-shimmer h-9 w-44 rounded-lg" />

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
