import Link from 'next/link'
import StarRating from './StarRating'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'

interface RestaurantCardProps {
  restaurant: Restaurant
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const priceDisplay = '$'.repeat(restaurant.price_range)
  const avgRating = restaurant.avg_rating || 0

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100/80 cursor-pointer transition-all duration-300 group overflow-hidden hover:-translate-y-1.5">
        <div className="p-5 space-y-4">
          {/* Restaurant Name and Details */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-lg line-clamp-2 group-hover:text-amber-700 transition-colors">
                {restaurant.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
                <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold">
                  {restaurant.cuisine}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-gray-400" />
                  {restaurant.city}
                </span>
              </div>
            </div>
            <span className="text-base font-bold text-amber-600 font-mono whitespace-nowrap">
              {priceDisplay}
            </span>
          </div>

          {/* Gastronome Rating */}
          <div className="flex items-center gap-3 py-2.5 px-3 bg-amber-50/50 rounded-xl">
            <StarRating rating={Math.round(avgRating)} size={16} readonly />
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-gray-900">
                {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
              </span>
              <span className="text-xs text-gray-500">
                ({restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          </div>

          {/* External Scores Row */}
          {(restaurant.google_rating || restaurant.yelp_rating || restaurant.beli_score) && (
            <div className="flex items-center gap-2 flex-wrap">
              {restaurant.google_rating != null && Number(restaurant.google_rating) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs font-semibold text-blue-500">Google</span>
                  <span className="text-sm font-bold text-blue-700">{Number(restaurant.google_rating).toFixed(1)}</span>
                  {restaurant.google_review_count != null && restaurant.google_review_count > 0 && (
                    <span className="text-xs text-blue-400">({restaurant.google_review_count > 999 ? (restaurant.google_review_count / 1000).toFixed(1) + 'k' : restaurant.google_review_count})</span>
                  )}
                </div>
              )}
              {restaurant.yelp_rating != null && Number(restaurant.yelp_rating) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 rounded-lg border border-red-100">
                  <span className="text-xs font-semibold text-red-500">Yelp</span>
                  <span className="text-sm font-bold text-red-700">{Number(restaurant.yelp_rating).toFixed(1)}</span>
                  {restaurant.yelp_review_count != null && restaurant.yelp_review_count > 0 && (
                    <span className="text-xs text-red-400">({restaurant.yelp_review_count > 999 ? (restaurant.yelp_review_count / 1000).toFixed(1) + 'k' : restaurant.yelp_review_count})</span>
                  )}
                </div>
              )}
              {restaurant.beli_score != null && Number(restaurant.beli_score) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 rounded-lg border border-purple-100">
                  <span className="text-xs font-semibold text-purple-500">Beli</span>
                  <span className="text-sm font-bold text-purple-700">{Number(restaurant.beli_score).toFixed(0)}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end pt-1">
            <span className="text-xs text-gray-400 group-hover:text-amber-600 transition-colors font-medium">
              View details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
