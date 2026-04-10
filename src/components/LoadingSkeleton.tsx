export function ReviewCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="h-1.5 animate-shimmer" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-shimmer" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 animate-shimmer rounded w-1/3" />
            <div className="h-3 animate-shimmer rounded w-1/4" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-5 animate-shimmer rounded w-3/4" />
          <div className="h-4 animate-shimmer rounded w-full" />
          <div className="h-4 animate-shimmer rounded w-5/6" />
        </div>
      </div>
    </div>
  )
}

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

export function ProfileSkeleton() {
  return (
    <div>
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 py-12 sm:py-16 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full animate-shimmer" />
            <div className="flex-1 w-full space-y-4">
              <div className="h-8 animate-shimmer rounded w-1/2" />
              <div className="h-4 animate-shimmer rounded w-1/3" />
              <div className="h-16 animate-shimmer rounded w-full" />
              <div className="flex gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-6 animate-shimmer rounded w-12" />
                    <div className="h-3 animate-shimmer rounded w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="py-12 space-y-6 max-w-4xl mx-auto px-4 sm:px-6">
        {[1, 2, 3].map((i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <ReviewCardSkeleton key={i} />
      ))}
    </div>
  )
}
