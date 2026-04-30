export function RestaurantCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden h-full">
      <div className="h-32 animate-shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-5 animate-shimmer rounded w-3/4" />
        <div className="flex items-center gap-2">
          <div className="h-3 animate-shimmer rounded w-3" />
          <div className="h-3 animate-shimmer rounded w-24" />
        </div>
        <div className="h-3 animate-shimmer rounded w-16" />
      </div>
    </div>
  )
}
