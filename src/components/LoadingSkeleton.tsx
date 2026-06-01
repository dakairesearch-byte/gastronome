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

/**
 * Placeholder for the canonical card's `hero` variant (CD9) — mirrors
 * RestaurantCard's photo-led layout (16:10 media, padded body, title +
 * rating row, subtitle, accolade row) so a loading grid reserves the
 * same box and the real cards don't shift in on hydration (CLS). Shimmer
 * blocks use the --color-skeleton-* tokens via the shared
 * `.animate-shimmer` utility.
 */
export function RestaurantCardHeroSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white h-full flex flex-col">
      {/* Media — matches the real card's aspect-[16/10] hero photo. */}
      <div className="aspect-[16/10] animate-shimmer" />

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        {/* Title + rating cluster row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="h-4 animate-shimmer rounded w-5/6" />
            <div className="h-4 animate-shimmer rounded w-2/3" />
          </div>
          <div className="h-4 animate-shimmer rounded w-12 shrink-0" />
        </div>

        {/* Subtitle: cuisine pill + price + neighborhood */}
        <div className="flex items-center gap-2">
          <div className="h-4 animate-shimmer rounded-full w-16" />
          <div className="h-3 animate-shimmer rounded w-6" />
          <div className="h-3 animate-shimmer rounded w-20" />
        </div>

        {/* Accolade row, pinned to the bottom like the real card. */}
        <div className="mt-auto pt-1">
          <div className="h-4 animate-shimmer rounded-full w-24" />
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder for the canonical card's `compact` variant (CD9) — mirrors
 * RestaurantCard's 80x80 thumbnail + content layout used in city/recent
 * feeds and search results, so list grids hold their height while data
 * loads (CLS). Uses the --color-skeleton-* tokens via `.animate-shimmer`.
 */
export function RestaurantCardCompactSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
      <div className="flex gap-3 p-3 sm:p-4">
        {/* 80x80 thumbnail */}
        <div className="shrink-0 w-20 h-20 rounded-xl animate-shimmer" />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <div className="h-5 animate-shimmer rounded w-3/4" />
          {/* Cuisine + price + location row */}
          <div className="flex items-center gap-2">
            <div className="h-4 animate-shimmer rounded-full w-14" />
            <div className="h-3 animate-shimmer rounded w-6" />
            <div className="h-3 animate-shimmer rounded w-24" />
          </div>
          {/* Source ratings bar */}
          <div className="h-4 animate-shimmer rounded w-32" />
        </div>
      </div>
    </div>
  )
}
