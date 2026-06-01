/**
 * Route-level loading skeleton for /restaurants/[id].
 * Hero photo + title block + ratings row + content columns.
 */
export default function RestaurantDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="animate-shimmer h-4 rounded w-48 mb-6" />
      <div className="animate-shimmer h-64 sm:h-80 rounded-2xl mb-6" />
      <div className="space-y-4 mb-8">
        <div className="animate-shimmer h-9 rounded w-2/3" />
        <div className="flex gap-3">
          <div className="animate-shimmer h-4 rounded w-24" />
          <div className="animate-shimmer h-4 rounded w-32" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer h-20 rounded-xl flex-1 min-w-[120px]"
          />
        ))}
      </div>
      <div className="space-y-3">
        <div className="animate-shimmer h-5 rounded w-40" />
        <div className="animate-shimmer h-4 rounded w-full" />
        <div className="animate-shimmer h-4 rounded w-5/6" />
        <div className="animate-shimmer h-4 rounded w-3/4" />
      </div>
    </div>
  )
}
