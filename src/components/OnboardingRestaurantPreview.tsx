'use client'

import { MapPin } from 'lucide-react'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import type { Restaurant } from '@/types/database'

interface OnboardingRestaurantPreviewProps {
  restaurant: Restaurant
}

/**
 * Display-only restaurant preview card used ONLY within the onboarding flow.
 * Intentionally does NOT wrap in a Link or attach click handlers — users
 * must not be able to navigate away from /onboarding.
 */
export default function OnboardingRestaurantPreview({
  restaurant,
}: OnboardingRestaurantPreviewProps) {
  const photoUrl = restaurant.photo_url || restaurant.google_photo_url
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.james_beard_nominated ||
    restaurant.eater_38

  return (
    <div
      role="presentation"
      className="rounded-xl border border-emerald-100 bg-white overflow-hidden shadow-sm"
    >
      {photoUrl && (
        <div className="relative aspect-video bg-gray-100">
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wide rounded-md">
            Preview
          </span>
        </div>
      )}
      <div className="p-4 space-y-2">
        <h4 className="font-bold text-gray-900 text-sm line-clamp-1">
          {restaurant.name}
        </h4>

        <div className="flex items-center gap-1.5 flex-wrap">
          {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">
              {restaurant.cuisine}
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
            <MapPin size={10} />
            {restaurant.neighborhood || restaurant.city}
          </span>
        </div>

        {hasAccolades && (
          <AccoladesBadges restaurant={restaurant} maxBadges={2} />
        )}

        <SourceRatingsBar restaurant={restaurant} compact />
      </div>
    </div>
  )
}
