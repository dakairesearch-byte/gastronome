interface RatingBadgeProps {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  reviewCount?: number
}

export default function RatingBadge({ rating, size = 'md', reviewCount }: RatingBadgeProps) {
  if (!rating || rating === 0) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-400 font-semibold ${
        size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'
      }`}>
        --
      </span>
    )
  }

  const bg = rating >= 4 ? 'bg-amber-500' : rating >= 3 ? 'bg-amber-400' : 'bg-gray-400'

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center justify-center rounded-full ${bg} text-white font-bold ${
        size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'
      }`}>
        {rating.toFixed(1)}
      </span>
      {reviewCount != null && (
        <span className="text-xs text-gray-400">
          {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
        </span>
      )}
    </div>
  )
}
