import { Star } from 'lucide-react'

interface PlatformRating {
  platform: string
  rating: number | null
  reviewCount: number | null
  color: string
  bgColor: string
  icon: string
}

interface AggregatedRatingsProps {
  googleRating: number | null
  googleReviewCount: number | null
  yelpRating: number | null
  yelpReviewCount: number | null
  beliScore: number | null
  gastronomeRating: number | null
  gastronomeReviewCount: number
}

export default function AggregatedRatings({
  googleRating,
  googleReviewCount,
  yelpRating,
  yelpReviewCount,
  beliScore,
  gastronomeRating,
  gastronomeReviewCount,
}: AggregatedRatingsProps) {
  const platforms: PlatformRating[] = [
    {
      platform: 'Gastronome',
      rating: gastronomeRating,
      reviewCount: gastronomeReviewCount,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50 border-amber-200',
      icon: '\u{1F37D}\uFE0F',
    },
    {
      platform: 'Google',
      rating: googleRating,
      reviewCount: googleReviewCount,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200',
      icon: '\u{1F50D}',
    },
    {
      platform: 'Yelp',
      rating: yelpRating,
      reviewCount: yelpReviewCount,
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200',
      icon: '\u{1F7E5}',
    },
  ]

  const availableRatings = platforms.filter((p) => p.rating !== null && p.rating !== undefined)
  const compositeScore =
    availableRatings.length > 0
      ? availableRatings.reduce((sum, p) => sum + (p.rating || 0), 0) / availableRatings.length
      : null

  const hasAnyRating = availableRatings.length > 0 || beliScore !== null

  if (!hasAnyRating) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">Ratings Across Platforms</h3>

      {compositeScore !== null && availableRatings.length > 1 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
            Composite Score
          </p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-bold text-gray-900">
              {compositeScore.toFixed(1)}
            </p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  className={
                    star <= Math.round(compositeScore)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300'
                  }
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Average of {availableRatings.length} platforms
          </p>
        </div>
      )}

      <div className="space-y-2">
        {platforms.map((p) => (
          <div
            key={p.platform}
            className={`flex items-center justify-between p-3 rounded-lg border ${p.bgColor}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{p.icon}</span>
              <span className={`font-semibold text-sm ${p.color}`}>
                {p.platform}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {p.rating !== null && p.rating !== undefined ? (
                <>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={12}
                        className={
                          star <= Math.round(p.rating!)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300'
                        }
                      />
                    ))}
                  </div>
                  <span className="font-bold text-gray-900 text-sm">
                    {p.rating.toFixed(1)}
                  </span>
                  {p.reviewCount !== null && p.reviewCount !== undefined && (
                    <span className="text-xs text-gray-500">
                      ({p.reviewCount.toLocaleString()})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-gray-400 italic">No data</span>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between p-3 rounded-lg border bg-purple-50 border-purple-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">\u{1F4CA}</span>
            <span className="font-semibold text-sm text-purple-700">Beli</span>
          </div>
          <div className="flex items-center gap-2">
            {beliScore !== null && beliScore !== undefined ? (
              <>
                <span className="font-bold text-gray-900 text-sm">
                  {beliScore.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">ranked score</span>
              </>
            ) : (
              <span className="text-xs text-gray-400 italic">No data</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
