import Link from 'next/link'
import { Star } from 'lucide-react'
import type { Restaurant } from '@/types/database'

interface SuggestionCardProps {
  restaurant: Restaurant
}

/**
 * Figma "Suggestions" card: photo + cuisine label + name + rating/review count.
 * Replaces TrendingCard on the homepage.
 */
export default function SuggestionCard({ restaurant }: SuggestionCardProps) {
  const photo =
    restaurant.photo_url ||
    restaurant.google_photo_url ||
    restaurant.yelp_photo_url ||
    null

  const rating = restaurant.google_rating ?? restaurant.yelp_rating ?? null
  const reviewCount = restaurant.google_review_count ?? restaurant.yelp_review_count ?? null

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group block rounded-sm shadow-md overflow-hidden transition-all hover:shadow-2xl cursor-pointer"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="overflow-hidden relative rounded-sm aspect-[3/4]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl font-bold"
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {restaurant.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="p-5">
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.12em',
            fontWeight: 500,
          }}
        >
          {restaurant.cuisine && restaurant.cuisine !== 'Restaurant'
            ? restaurant.cuisine
            : 'Restaurant'}
        </p>
        <h3
          className="text-xl mb-3"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
          }}
        >
          {restaurant.name}
        </h3>
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {rating != null ? (
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-current" style={{ color: 'var(--color-primary)' }} />
              <span
                className="text-sm"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {rating.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
              No rating yet
            </span>
          )}
          {reviewCount != null && (
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              {reviewCount.toLocaleString()} reviews
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
