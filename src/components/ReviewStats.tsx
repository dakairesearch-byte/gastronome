import { Star } from 'lucide-react'

interface ReviewStatsProps {
  ratings: number[]
  totalReviews: number
  averageRating: number
}

export default function ReviewStats({
  ratings,
  totalReviews,
  averageRating,
}: ReviewStatsProps) {
  const getRatingCount = (star: number) => {
    return ratings.filter((r) => r === star).length
  }

  const getPercentage = (count: number) => {
    return totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
  }

  return (
    <div className="space-y-6">
      {/* Overall Rating */}
      <div className="flex items-center gap-8">
        <div className="text-center">
          <p className="text-5xl font-bold text-gray-900">
            {averageRating.toFixed(1)}
          </p>
          <div className="flex gap-1 justify-center mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                className={
                  star <= Math.round(averageRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-300'
                }
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Rating Bars */}
        <div className="flex-1 space-y-3">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = getRatingCount(star)
            const percentage = getPercentage(count)
            return (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12">
                  <span className="text-sm font-medium text-gray-700">
                    {star}
                  </span>
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
