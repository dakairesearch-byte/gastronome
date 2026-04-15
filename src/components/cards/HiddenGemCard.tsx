import Link from 'next/link'
import { MapPin, Sparkles } from 'lucide-react'
import type { TrendingRestaurant } from '@/lib/ranking/trending'

interface HiddenGemCardProps {
  restaurant: TrendingRestaurant
}

/**
 * Hidden-gem tile for Explore. Shows a small "High velocity" badge that
 * explains the selection rule, plus the restaurant's recent event counts
 * (how many videos/reviews/photos came in during the window). No
 * aggregate star, no rank number.
 */
export default function HiddenGemCard({ restaurant }: HiddenGemCardProps) {
  const counts = restaurant.trending_counts
  const bits: string[] = []
  if (counts.videos > 0) bits.push(`${counts.videos} video${counts.videos === 1 ? '' : 's'}`)
  if (counts.reviews > 0) bits.push(`${counts.reviews} review${counts.reviews === 1 ? '' : 's'}`)
  if (counts.photos > 0) bits.push(`${counts.photos} photo${counts.photos === 1 ? '' : 's'}`)

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block rounded-2xl border border-gray-100 bg-white p-5 hover:border-purple-300 hover:shadow-md transition-all"
    >
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
        <Sparkles size={11} />
        High velocity
      </div>
      <h3 className="mt-3 font-extrabold text-gray-900 leading-tight line-clamp-2 group-hover:text-purple-700 transition-colors">
        {restaurant.name}
      </h3>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
            {restaurant.cuisine}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 truncate">
          <MapPin size={11} className="text-gray-400 flex-shrink-0" />
          {restaurant.city || '—'}
        </span>
      </div>
      {bits.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-500">
          Recent: {bits.join(' • ')}
        </p>
      )}
    </Link>
  )
}
