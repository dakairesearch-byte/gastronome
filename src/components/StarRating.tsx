import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  size?: number
  readonly?: boolean
  onRate?: (rating: number) => void
}

export default function StarRating({
  rating,
  size = 16,
  readonly = true,
  onRate,
}: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onRate?.(star)}
          disabled={readonly}
          className={`transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
          }`}
        >
          <Star
            size={size}
            className={
              star <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300'
            }
          />
        </button>
      ))}
    </div>
  )
}
