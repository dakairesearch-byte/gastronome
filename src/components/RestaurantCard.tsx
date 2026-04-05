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
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md border border-amber-50 cursor-pointer transition-all group overflow-hidden">
        <div className="p-4 sm:p-6 space-y-3">
          {/* Restaurant Name and Details */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 group-hover:text-amber-600 transition-colors">
                {restaurant.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <span className="inline-block px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-gray-500" />
                  {restaurant.city}
                </span>
              </div>
            </div>
          </div>

          {/* Rating and Reviews */}
          <div className="flex items-center gap-3 py-2 border-t border-b border-gray-100">
            <StarRating rating={Math.round(avgRating)} size={16} readonly />
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-gray-900">
                {avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}
              </span>
              <span className="text-sm text-gray-500">
                {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-lg font-bold text-amber-600 font-mono">
              {priceDisplay}
            </span>
            <span className="text-xs text-gray-500 group-hover:text-amber-600 transition-colors font-medium">
              View details â
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import StarRating from './StarRating';

interface RestaurantCardProps {
  restaurant: Restaurant;
  averageRating?: number;
  reviewCount?: number;
}

export default function RestaurantCard({
  restaurant,
  averageRating = 0,
  reviewCount = 0,
}: RestaurantCardProps) {
  const priceDisplay = ''.padEnd(restaurant.price_range || 1, '$');

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div className="group rounded-2xl bg-neutral-900/50 border border-neutral-800/50 overflow-hidden hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 hover:scale-[1.02] cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="relative w-full h-48 overflow-hidden bg-gradient-to-br from-amber-600/20 via-neutral-900 to-neutral-950">
          {restaurant.image_url ? (
            <img
              src={restaurant.image_url}
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-4xl text-neutral-700">🍽️</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-2">
              {restaurant.name}
            </h3>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            {restaurant.cuisine_type && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 rounded-full">
                {restaurant.cuisine_type}
              </span>
            )}
            {restaurant.price_range && (
              <span className="px-2 py-1 text-xs font-medium bg-neutral-800 text-neutral-400 rounded-full">
                {priceDisplay}
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-3">
            <StarRating rating={Math.round(averageRating * 2) / 2} size="sm" />
            <span className="text-xs text-neutral-400">
              {averageRating > 0 ? averageRating.toFixed(1) : 'No'} ({reviewCount})
            </span>
          </div>

          {/* Location */}
          <p className="text-xs text-neutral-500 mt-auto">
            {restaurant.city && restaurant.state
              ? `${restaurant.city}, ${restaurant.state}`
              : 'Location TBA'}
          </p>
        </div>
      </div>
    </Link>
  );
}
