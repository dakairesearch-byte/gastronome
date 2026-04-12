import Link from 'next/link'
import { MapPin, Star, Music2, Camera } from 'lucide-react'
import AccoladesBadges from './AccoladesBadges'
import TrendingBadge from './TrendingBadge'
import type { Restaurant } from '@/types/database'
import type { TrendingTier } from '@/lib/placement'
import { getCompositeRating } from '@/lib/compositeRating'

export type RestaurantVideoBuzz = {
  tiktok: { likes: number; views: number; count: number }
  instagram: { likes: number; views: number; count: number }
  totalCount: number
}

interface RestaurantRowProps {
  restaurant: Restaurant
  rank?: number
  showRank?: boolean
  trendingTier?: TrendingTier
  buzz?: RestaurantVideoBuzz
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function rankStyles(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white ring-2 ring-amber-200'
  if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-white ring-2 ring-gray-200'
  if (rank === 3) return 'bg-gradient-to-br from-amber-600 to-orange-700 text-white ring-2 ring-orange-200'
  if (rank <= 10) return 'bg-emerald-500 text-white'
  return 'bg-gray-200 text-gray-600'
}

const SOURCE_STYLES: Record<
  'google' | 'yelp' | 'infatuation',
  { bg: string; text: string; border: string; label: string; icon: string }
> = {
  google: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Google', icon: 'G' },
  yelp: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Yelp', icon: 'Y' },
  infatuation: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Infatuation', icon: 'TI' },
}

function SourceBlock({
  source,
  rating,
  maxRating,
  reviewCount,
}: {
  source: 'google' | 'yelp' | 'infatuation'
  rating: number
  maxRating: number
  reviewCount?: number | null
}) {
  const s = SOURCE_STYLES[source]
  return (
    <div
      className={`flex flex-col items-center justify-center min-w-[64px] px-2.5 py-1.5 rounded-lg border ${s.bg} ${s.text} ${s.border}`}
    >
      <div className="flex items-baseline gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{s.icon}</span>
        <span className="text-sm font-bold leading-none">
          {rating.toFixed(1)}
          <span className="text-[10px] font-semibold opacity-60">/{maxRating}</span>
        </span>
      </div>
      {reviewCount != null && reviewCount > 0 && (
        <span className="text-[10px] opacity-70 mt-0.5">{formatCount(reviewCount)} rev</span>
      )}
    </div>
  )
}

export default function RestaurantRow({
  restaurant,
  rank,
  showRank,
  trendingTier,
  buzz,
}: RestaurantRowProps) {
  const composite = getCompositeRating(restaurant)

  const hasAnyRating =
    restaurant.google_rating != null ||
    restaurant.yelp_rating != null ||
    restaurant.infatuation_rating != null

  const hasAccolades =
    restaurant.michelin_stars > 0 ||
    restaurant.michelin_designation ||
    restaurant.james_beard_winner ||
    restaurant.james_beard_nominated ||
    restaurant.eater_38

  const snippet = restaurant.infatuation_review_snippet?.trim()
  const hasBuzz = buzz && buzz.totalCount > 0

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block bg-white border-b border-gray-100 hover:bg-emerald-50/40 transition-colors border-l-4 border-l-transparent hover:border-l-emerald-500"
    >
      <div className="px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-start gap-4">
        {/* Rank */}
        {showRank && rank != null && (
          <div className="flex-shrink-0 md:pt-0.5">
            <span
              className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-extrabold ${rankStyles(rank)}`}
            >
              {rank}
            </span>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header row: name + cuisine/neighborhood + price */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight group-hover:text-emerald-600 transition-colors truncate">
                {restaurant.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 flex-wrap">
                {trendingTier && trendingTier !== 'none' && <TrendingBadge tier={trendingTier} />}
                {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                    {restaurant.cuisine}
                  </span>
                )}
                {restaurant.neighborhood && (
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <MapPin size={13} className="text-gray-400" />
                    {restaurant.neighborhood}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {composite && (
                <div className="flex items-center gap-1 text-gray-900">
                  <Star size={15} className="fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold">{composite.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Source ratings bar — centerpiece */}
          {hasAnyRating && (
            <div className="mt-3 flex flex-wrap items-stretch gap-2">
              {restaurant.google_rating != null && (
                <SourceBlock
                  source="google"
                  rating={restaurant.google_rating}
                  maxRating={5}
                  reviewCount={restaurant.google_review_count}
                />
              )}
              {restaurant.yelp_rating != null && (
                <SourceBlock
                  source="yelp"
                  rating={restaurant.yelp_rating}
                  maxRating={5}
                  reviewCount={restaurant.yelp_review_count}
                />
              )}
              {restaurant.infatuation_rating != null && (
                <SourceBlock
                  source="infatuation"
                  rating={restaurant.infatuation_rating}
                  maxRating={10}
                />
              )}
            </div>
          )}

          {/* Video buzz row */}
          {hasBuzz && (
            <div className="mt-2.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {buzz!.tiktok.count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Music2 size={12} className="text-gray-500" />
                  {formatCount(buzz!.tiktok.likes)} likes
                </span>
              )}
              {buzz!.instagram.count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Camera size={12} className="text-gray-500" />
                  {formatCount(buzz!.instagram.likes)} likes
                </span>
              )}
              <span className="text-gray-400">
                {buzz!.totalCount} video{buzz!.totalCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Accolades */}
          {hasAccolades && (
            <div className="mt-2.5">
              <AccoladesBadges restaurant={restaurant} maxBadges={4} />
            </div>
          )}

          {/* Review snippet */}
          {snippet && (
            <p className="mt-2.5 text-sm italic text-gray-500 line-clamp-2">
              &ldquo;{truncate(snippet, 160)}&rdquo;
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
