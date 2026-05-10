import Link from 'next/link'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import { Restaurant } from '@/types/database'
import { MapPin } from 'lucide-react'
import { GoogleGIcon, YelpIcon } from '@/components/brands/BrandIcons'

interface RestaurantCardProps {
  restaurant: Restaurant
  /**
   * `compact` (default): the original lightweight card used across the
   * app — no photo, full SourceRatingsBar with all sources stacked.
   * `hero`: photo-led card used on category landing pages (Michelin,
   * Bib, Eater 38, …) where eye-catchiness matters more than density.
   * Renders a top photo, a tighter rating cluster (Google + Yelp brand
   * marks) and a single neighborhood-only subtitle so cards scan
   * faster across a long list. Default left intact so other callers
   * (search results, profile lists, recent) don't visually change.
   */
  variant?: 'compact' | 'hero'
}

function getBorderAccent(restaurant: Restaurant): string {
  if (restaurant.michelin_stars > 0 || restaurant.michelin_designation)
    return 'border-l-4 border-l-red-400'
  // `james_beard_nominated` was dropped — only winners get the accent now.
  if (restaurant.james_beard_winner) return 'border-l-4 border-l-amber-400'
  if (restaurant.eater_38) return 'border-l-4 border-l-pink-400'
  return ''
}

/**
 * Photo fallback chain used elsewhere in the codebase
 * (FavoritesSection, OnboardingRestaurantPreview, …):
 *   photo_url → photo_urls[0] → google_photo_url → null.
 * Keep the chain identical so cards render the same image regardless
 * of which surface they're embedded in.
 */
function getHeroPhoto(restaurant: Restaurant): string | null {
  return (
    restaurant.photo_url ||
    (restaurant.photo_urls && restaurant.photo_urls[0]) ||
    restaurant.google_photo_url ||
    null
  )
}

export default function RestaurantCard({
  restaurant,
  variant = 'compact',
}: RestaurantCardProps) {
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.james_beard_winner ||
    restaurant.eater_38

  const borderAccent = getBorderAccent(restaurant)

  if (variant === 'hero') {
    return <HeroVariant restaurant={restaurant} borderAccent={borderAccent} />
  }

  return (
    <Link href={`/restaurants/${restaurant.id}`}>
      <div
        className={`rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-100 overflow-hidden bg-white cursor-pointer group ${borderAccent}`}
      >
        <div className="p-4 sm:p-5 space-y-2.5">
          {/* Restaurant Name */}
          <div>
            <h3 className="font-bold text-gray-900 text-lg line-clamp-1 min-w-0 group-hover:text-emerald-600 transition-colors">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={14} />
                {restaurant.city}
                {restaurant.neighborhood && (
                  <span className="text-gray-400">&middot; {restaurant.neighborhood}</span>
                )}
              </span>
            </div>
          </div>

          {/* Accolade badges — own row below name */}
          {hasAccolades && <AccoladesBadges restaurant={restaurant} maxBadges={3} />}

          {/* Source Ratings Bar */}
          <SourceRatingsBar restaurant={restaurant} />
        </div>
      </div>
    </Link>
  )
}

/**
 * Hero variant — photo top, name + neighborhood, accolade pills, brand
 * rating cluster (Google + Yelp side-by-side). Designed for the Explore
 * categories grid where the user sees 30–150 cards in a row and needs
 * each card to be instantly scannable. Cuisine pill is dropped when it
 * would just say "Restaurant" or "Fine Dining" — that filler is the
 * single biggest source of visual noise in the current Michelin list.
 */
function HeroVariant({
  restaurant,
  borderAccent,
}: {
  restaurant: Restaurant
  borderAccent: string
}) {
  const photo = getHeroPhoto(restaurant)
  const showCuisine =
    restaurant.cuisine &&
    restaurant.cuisine !== 'Restaurant' &&
    restaurant.cuisine !== 'Fine Dining'
  const googleRating =
    typeof restaurant.google_rating === 'number' ? restaurant.google_rating : null
  const yelpRating =
    typeof restaurant.yelp_rating === 'number' ? restaurant.yelp_rating : null
  const hasAccolades =
    (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
    restaurant.michelin_designation ||
    restaurant.james_beard_winner ||
    restaurant.eater_38

  return (
    <Link href={`/restaurants/${restaurant.id}`} className="block h-full">
      <div
        className={`rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 overflow-hidden bg-white cursor-pointer group h-full flex flex-col ${borderAccent}`}
      >
        {/* Photo or accolade-themed gradient hero */}
        <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={restaurant.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: borderAccent.includes('red')
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                  : borderAccent.includes('amber')
                  ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                  : borderAccent.includes('pink')
                  ? 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)'
                  : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
              }}
            >
              <span
                className="text-3xl font-light"
                style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-base line-clamp-1 min-w-0 flex-1 group-hover:text-emerald-600 transition-colors">
              {restaurant.name}
            </h3>

            {/* Brand-mark rating cluster — Google G + Yelp burst inline.
                Tighter than SourceRatingsBar (which stacks Google, Yelp,
                Infatuation, Beli vertically). The hero card needs the
                rating to read as a single glance, not a bar of badges. */}
            <div className="flex-shrink-0 flex items-center gap-2 text-sm font-medium text-gray-700">
              {googleRating != null && (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={`Google rating ${googleRating.toFixed(1)}`}
                >
                  <GoogleGIcon size={14} title="Google" />
                  <span>{googleRating.toFixed(1)}</span>
                </span>
              )}
              {yelpRating != null && (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={`Yelp rating ${yelpRating.toFixed(1)}`}
                >
                  <YelpIcon size={14} title="Yelp" />
                  <span>{yelpRating.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Subtitle: cuisine pill (when meaningful) + neighborhood.
              Dropping the city — the user is already filtered to one
              city via CategoryFilters, so repeating it on every card is
              just noise. */}
          {(showCuisine || restaurant.neighborhood) && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              {showCuisine && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              {restaurant.neighborhood && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} />
                  {restaurant.neighborhood}
                </span>
              )}
            </div>
          )}

          {hasAccolades && (
            <div className="mt-auto pt-1">
              <AccoladesBadges restaurant={restaurant} maxBadges={3} />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
