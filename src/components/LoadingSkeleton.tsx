export function ReviewCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-50 overflow-hidden animate-pulse">
      <div className="w-full h-48 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
        <div className="pt-2 border-t border-amber-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="space-y-1">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-2 bg-gray-100 rounded w-16" />
            </div>
          </div>
          <div className="h-3 bg-gray-200 rounded w-12" />
        </div>
      </div>
    </div>
  )
}

export function RestaurantCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-50 p-4 animate-pulse">
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-4 h-4 bg-gray-200 rounded" />
              ))}
            </div>
            <div className="h-4 bg-gray-200 rounded w-12" />
            <div className="h-3 bg-gray-100 rounded w-10" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-8" />
        </div>
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 py-12 sm:py-16 border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-200 rounded-full" />
            <div className="flex-1 w-full space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-16 bg-gray-100 rounded w-full" />
              <div className="flex gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-6 bg-gray-200 rounded w-12" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="py-12 space-y-6">
        {[1, 2, 3].map((i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <ReviewCardSkeleton key={i} />
      ))}
    </div>
  )
}
