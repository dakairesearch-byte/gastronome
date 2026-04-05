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
