'use client'

import { useState } from 'react'
import Link from 'next/link'
import SourceRatingsBar from './SourceRatingsBar'
import AccoladesBadges from './AccoladesBadges'
import BookmarkButton from './BookmarkButton'
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

/**
 * Border accent tier — color-only signal previously, now paired with
 * a visually-hidden text label (see `accoladeTierLabel`) so accolade
 * tier is also conveyed to screen readers and color-blind users.
 *
 * Border colors map to the semantic accolade tokens in globals.css so
 * a future rebrand can change one variable and every card updates.
 * We keep the Tailwind `border-l-<color>-400` classes here because the
 * design system uses Tailwind utilities for layout; a tokenized
 * inline-style version is in `borderAccentStyle` below for cases that
 * want pure CSS-var-driven borders.
 */
function getBorderAccent(restaurant: Restaurant): string {
  if (restaurant.michelin_stars > 0 || restaurant.michelin_designation)
    return 'border-l-4 border-l-red-400'
  // `james_beard_nominated` was dropped — only winners get the accent now.
  if (restaurant.james_beard_winner) return 'border-l-4 border-l-amber-400'
  if (restaurant.eater_38) return 'border-l-4 border-l-pink-400'
  return ''
}

/**
 * Plain-English label for the accolade tier reflected in the colored
 * left border, rendered as `sr-only` text so the tier is announced to
 * screen readers and color-blind users (who otherwise just see a
 * red/amber/pink stripe with no semantic content).
 */
function accoladeTierLabel(restaurant: Restaurant): string | null {
  if (restaurant.michelin_stars > 0 || restaurant.michelin_designation)
    return 'Michelin-recognized restaurant'
  if (restaurant.james_beard_winner) return 'James Beard winner'
  if (restaurant.eater_38) return 'Eater 38 listed'
  return null
}

/**
 * Map the integer price_range column (1-4, sourced from Google
 * Places `priceLevel` PRICE_LEVEL_INEXPENSIVE..VERY_EXPENSIVE) to the
 * conventional $ / $$ / $$$ / $$$$ string. Returns null when the value
 * is missing or out of range so callers can skip rendering rather
 * than showing a placeholder.
 */
function formatPriceLevel(
  range: number | null | undefined,
): '$' | '$$' | '$$$' | '$$$$' | null {
  if (range === 1) return '$'
  if (range === 2) return '$$'
  if (range === 3) return '$$$'
  if (range === 4) return '$$$$'
  return null
}

const PRICE_LEVEL_LABEL: Record<number, string> = {
  1: 'Inexpensive',
  2: 'Moderate',
  3: 'Expensive',
  4: 'Very expensive',
}

function priceLevelAriaLabel(range: number | null | undefined): string {
  return range && PRICE_LEVEL_LABEL[range]
    ? `Price: ${PRICE_LEVEL_LABEL[range]}`
    : 'Price unknown'
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
  const tierLabel = accoladeTierLabel(restaurant)

  if (variant === 'hero') {
    return <HeroVariant restaurant={restaurant} borderAccent={borderAccent} />
  }

  // Compact variant — was image-less text-only, which made city/recent
  // feeds wall-to-wall text and impossible to scan visually (flagged by
  // restaurant-card, food-photography, the-diner, mobile-responsive in
  // sweep v2). Now: 80x80 thumbnail on the left + content on the right,
  // with price chip + first-letter monogram fallback when no photo.
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const thumbnail = thumbnailFailed ? null : getHeroPhoto(restaurant)
  const priceLevel = formatPriceLevel(restaurant.price_range)

  // Stretched-link pattern: the card root is a plain <div>, the whole
  // surface is made clickable by an absolutely-positioned overlay <Link>,
  // and the visual content sits above it with pointer-events-none so dead
  // areas fall through to the overlay. Interactive children (source
  // links, accolade links, the Save button) re-enable pointer events and
  // sit above the overlay. This adds the Save action AND fixes the
  // pre-existing nested-anchor violation (SourceRatingsBar/AccoladesBadges
  // anchors were previously nested inside the card-wide <Link>). WCAG 4.1.2.
  return (
    <div
      className={`relative rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-100 overflow-hidden bg-white group ${borderAccent}`}
    >
      {tierLabel && <span className="sr-only">{tierLabel}.</span>}

      <Link
        href={`/restaurants/${restaurant.id}`}
        className="absolute inset-0 z-0"
        aria-label={restaurant.name}
      />

      <div className="relative z-[1] flex gap-3 p-3 sm:p-4 pointer-events-none">
        <div
          className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100"
          aria-hidden="true"
        >
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setThumbnailFailed(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-skeleton-base) 0%, var(--color-skeleton-highlight) 100%)',
              }}
            >
              <span
                className="text-2xl font-light"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h3
              className="font-bold text-gray-900 text-lg line-clamp-1 min-w-0 group-hover:text-emerald-600 transition-colors pr-9"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              {priceLevel && (
                <span
                  className="font-semibold text-gray-700 text-sm"
                  aria-label={priceLevelAriaLabel(restaurant.price_range)}
                >
                  {priceLevel}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={14} aria-hidden="true" />
                <span>
                  {restaurant.city}
                  {restaurant.neighborhood && (
                    <span className="text-gray-400">&middot; {restaurant.neighborhood}</span>
                  )}
                </span>
              </span>
            </div>
          </div>

          {/* Interactive children re-enable pointer events so their own
              links work and their clicks don't fall through to the
              overlay. */}
          {hasAccolades && (
            <div className="pointer-events-auto w-fit">
              <AccoladesBadges restaurant={restaurant} maxBadges={3} />
            </div>
          )}

          <div className="pointer-events-auto w-fit">
            <SourceRatingsBar restaurant={restaurant} />
          </div>
        </div>
      </div>

      {/* Save button — above the overlay link, pointer-events restored. */}
      <div className="absolute top-2 right-2 z-[2] pointer-events-auto">
        <BookmarkButton restaurantId={restaurant.id} variant="card" />
      </div>
    </div>
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
  const initialPhoto = getHeroPhoto(restaurant)
  // Track image-load state so we can swap to the accolade-tinted
  // gradient if the upstream photo URL fails. Important because the
  // photo proxy at /api/photos/places/... can transiently fail
  // (Google quota, expired refs, network) — without this fallback
  // the card renders an empty gray box with just the alt text. We
  // still hint at the restaurant identity via the first letter on
  // the gradient so the card has visual presence.
  const [photoFailed, setPhotoFailed] = useState(false)
  const photo = photoFailed ? null : initialPhoto
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
  const priceLevel = formatPriceLevel(restaurant.price_range)
  const tierLabel = accoladeTierLabel(restaurant)

  // Describe the image rather than repeating the restaurant name (which
  // is already in the adjacent <h3>). Including cuisine context gives
  // screen-reader users the same "what kind of place is this?" signal
  // that sighted users get from the photo. Accessibility + food-photo
  // specialists both flagged this in v2 sweep.
  const photoAlt = restaurant.cuisine && restaurant.cuisine !== 'Restaurant'
    ? `${restaurant.cuisine} food at ${restaurant.name}`
    : `Photo of ${restaurant.name}`

  return (
    <div
      className={`relative rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 overflow-hidden bg-white group h-full flex flex-col ${borderAccent}`}
    >
      {tierLabel && <span className="sr-only">{tierLabel}.</span>}

      {/* Stretched overlay link — see compact-variant comment. */}
      <Link
        href={`/restaurants/${restaurant.id}`}
        className="absolute inset-0 z-0"
        aria-label={restaurant.name}
      />

      {/* Save button — above the photo + overlay link. */}
      <div className="absolute top-2 right-2 z-[2] pointer-events-auto">
        <BookmarkButton restaurantId={restaurant.id} variant="card" />
      </div>

      <div className="relative z-[1] flex flex-col h-full pointer-events-none">
        {/* Photo or accolade-themed gradient hero */}
        <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={photoAlt}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setPhotoFailed(true)}
              style={{ objectPosition: 'center 30%' }}
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
                style={{ color: 'var(--color-secondary)', opacity: 0.85 }}
                aria-hidden="true"
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-bold text-gray-900 text-base leading-snug line-clamp-2 min-w-0 flex-1 group-hover:text-emerald-600 transition-colors"
              title={restaurant.name}
            >
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

          {/* Subtitle: cuisine pill (when meaningful) + price level +
              neighborhood. Dropping the city — the user is already
              filtered to one city via CategoryFilters, so repeating
              it on every card is just noise. Price level renders as
              $ / $$ / $$$ / $$$$ from restaurants.price_range (the
              column Google's priceLevel field already maps to). When
              price is unknown we omit it rather than show "?" — a
              card with a known cuisine and unknown price should not
              be visually penalized. */}
          {(showCuisine || restaurant.neighborhood || priceLevel) && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              {showCuisine && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                  {restaurant.cuisine}
                </span>
              )}
              {priceLevel && (
                <span
                  className="font-semibold text-gray-700"
                  aria-label={priceLevelAriaLabel(restaurant.price_range)}
                  title={priceLevelAriaLabel(restaurant.price_range)}
                >
                  {priceLevel}
                </span>
              )}
              {restaurant.neighborhood && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} aria-hidden="true" />
                  {restaurant.neighborhood}
                </span>
              )}
            </div>
          )}

          {hasAccolades && (
            <div className="mt-auto pt-1 pointer-events-auto w-fit">
              <AccoladesBadges restaurant={restaurant} maxBadges={3} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
