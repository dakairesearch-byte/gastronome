import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import RestaurantCard from '@/components/RestaurantCard'
import type { Restaurant } from '@/types/database'
import AccoladesBadges from '@/components/AccoladesBadges'
import VideoGallery from '@/components/VideoGallery'
import ShareButton from '@/components/ShareButton'
import BookmarkButton from '@/components/BookmarkButton'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, Star } from 'lucide-react'
import BackButton from '@/components/BackButton'
import type { Metadata } from 'next'

export const revalidate = 60

/**
 * OG / Twitter metadata for restaurant pages (QA bug #62).
 *
 * Previously restaurant URLs pasted into Slack, iMessage, or Twitter
 * produced a bare link with no title or preview image — embarrassing
 * for an aggregator whose whole pitch is rich restaurant context. We
 * now synthesize a descriptive title, subtitle, and hero image from
 * whichever photo source is available (primary, Google, Yelp).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      'name, cuisine, city, neighborhood, photo_url, google_photo_url, yelp_photo_url, google_rating, description'
    )
    .eq('id', id)
    .single()

  if (!restaurant) {
    return { title: 'Restaurant not found · Gastronome' }
  }

  const where = [restaurant.neighborhood, restaurant.city]
    .filter(Boolean)
    .join(', ')
  const cuisine =
    restaurant.cuisine && restaurant.cuisine !== 'Restaurant'
      ? restaurant.cuisine
      : 'Restaurant'
  const ratingBit =
    typeof restaurant.google_rating === 'number'
      ? ` · ${restaurant.google_rating.toFixed(1)}★`
      : ''

  const title = `${restaurant.name} · ${cuisine}${where ? ' in ' + where : ''}${ratingBit}`
  const description =
    restaurant.description ||
    `Reviews from every major source for ${restaurant.name}${where ? ' in ' + where : ''}. See Google, Yelp, Beli, and Infatuation ratings side-by-side on Gastronome.`

  const image =
    restaurant.photo_url || restaurant.google_photo_url || restaurant.yelp_photo_url

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: image ? [{ url: image, alt: restaurant.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

async function getRestaurantData(restaurantId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant) return null

  // Parallel: related (prefer same cuisine, fall back to trending), video
  // count, and highlighted dishes (QA pass 2: previously fetched and
  // unused on this page — now rendered under "Signature Dishes").
  const [sameCuisine, trending, videoCountResult, dishesResult] =
    await Promise.all([
      restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && restaurant.city
        ? supabase
            .from('restaurants')
            .select('*')
            .ilike('city', restaurant.city)
            .ilike('cuisine', restaurant.cuisine)
            .neq('id', restaurantId)
            .order('google_rating', { ascending: false, nullsFirst: false })
            .limit(4)
        : Promise.resolve({ data: [] as Restaurant[] }),
      topTrendingRestaurants(supabase, {
        city: restaurant.city ?? undefined,
        window: '30d',
        limit: 8,
      }),
      supabase
        .from('restaurant_videos')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId),
      supabase
        .from('restaurant_highlighted_dishes')
        .select('dish_name, mention_count, rank')
        .eq('restaurant_id', restaurantId)
        .order('mention_count', { ascending: false })
        .limit(12),
    ])

  // Prefer same-cuisine picks; pad with trending; final fallback = any
  // restaurant in the same city.
  let relatedRestaurants: Restaurant[] = (sameCuisine.data ?? []) as Restaurant[]
  if (relatedRestaurants.length < 4) {
    const existing = new Set(relatedRestaurants.map((r) => r.id).concat(restaurantId))
    for (const r of trending) {
      if (relatedRestaurants.length >= 4) break
      if (!existing.has(r.id)) {
        relatedRestaurants.push(r)
        existing.add(r.id)
      }
    }
  }
  if (relatedRestaurants.length === 0 && restaurant.city) {
    const { data: fallback } = await supabase
      .from('restaurants')
      .select('*')
      .ilike('city', restaurant.city)
      .neq('id', restaurantId)
      .order('name')
      .limit(4)
    relatedRestaurants = (fallback ?? []) as Restaurant[]
  }

  // De-dupe dishes by normalized name, drop obvious junk, take top 6.
  const rawDishes = (dishesResult.data ?? []) as Array<{
    dish_name: string | null
    mention_count: number | null
    rank: number | null
  }>
  const seen = new Set<string>()
  const dishes: Array<{ name: string; count: number }> = []
  for (const d of rawDishes) {
    const name = (d.dish_name ?? '').trim()
    if (!name || name.length < 2) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    dishes.push({ name, count: d.mention_count ?? 0 })
    if (dishes.length >= 6) break
  }

  return {
    restaurant,
    relatedRestaurants,
    videoCount: videoCountResult.count ?? 0,
    dishes,
  }
}

type ScoreSource = {
  key: string
  label: string
  icon: string
  rating: number | null
  maxRating: number
  reviewCount?: number | null
  url: string | null
  badgeBg: string
}

function buildScoreSources(
  restaurant: NonNullable<Awaited<ReturnType<typeof getRestaurantData>>>['restaurant']
): ScoreSource[] {
  return [
    {
      key: 'google',
      label: 'Google',
      icon: 'G',
      rating: restaurant.google_rating,
      maxRating: 5,
      reviewCount: restaurant.google_review_count,
      url: restaurant.google_url,
      badgeBg: '#DBEAFE',
    },
    {
      key: 'yelp',
      label: 'Yelp',
      icon: 'Y',
      rating: restaurant.yelp_rating,
      maxRating: 5,
      reviewCount: restaurant.yelp_review_count,
      url: restaurant.yelp_url,
      badgeBg: '#FEE2E2',
    },
    {
      key: 'infatuation',
      label: 'Infatuation',
      icon: 'TI',
      rating: restaurant.infatuation_rating,
      maxRating: 10,
      reviewCount: null,
      url: restaurant.infatuation_url,
      badgeBg: '#FFEDD5',
    },
  ]
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getRestaurantData(id)

  if (!data) notFound()

  const { restaurant, relatedRestaurants, videoCount, dishes } = data
  const scoreSources = buildScoreSources(restaurant)
  const hasAccolades =
    restaurant.michelin_stars > 0 ||
    restaurant.michelin_designation ||
    restaurant.james_beard_winner ||
    restaurant.james_beard_nominated ||
    restaurant.eater_38
  const photoUrl = restaurant.photo_url || restaurant.google_photo_url
  const avgRating = restaurant.google_rating ?? restaurant.yelp_rating ?? null

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-8 pt-4 pb-8">
          <div className="flex items-center justify-between mb-4">
            <BackButton
              fallbackHref="/explore"
              ariaLabel="Back"
              className="inline-flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)' }}
            >
              Back
            </BackButton>
            <div className="flex items-center gap-2">
              <BookmarkButton restaurantId={restaurant.id} />
              <ShareButton
                title={restaurant.name}
                text={
                  restaurant.cuisine && restaurant.cuisine !== 'Restaurant'
                    ? `${restaurant.name} — ${restaurant.cuisine}${
                        restaurant.neighborhood ? ` in ${restaurant.neighborhood}` : ''
                      }`
                    : restaurant.name
                }
              />
            </div>
          </div>

          <div className="max-w-3xl">
            {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
              <span
                className="inline-block px-3 py-1 text-xs uppercase mb-3"
                style={{
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.12em',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                }}
              >
                {restaurant.cuisine}
              </span>
            )}

            <h1
              className="text-2xl sm:text-3xl mb-2"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 500,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {restaurant.name}
            </h1>

            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <MapPin size={13} />
              <span style={{ fontFamily: 'var(--font-body)' }}>
                {restaurant.neighborhood || restaurant.city}
                {restaurant.address && ` · ${restaurant.address}`}
              </span>
            </div>

            {avgRating != null && (
              <div className="flex items-center gap-1.5 mt-2">
                <Star size={14} className="fill-current" style={{ color: 'var(--color-primary)' }} />
                <span
                  className="text-sm"
                  style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-body)', fontWeight: 500 }}
                >
                  {avgRating.toFixed(1)}
                </span>
              </div>
            )}

            {/* Contact inline */}
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="inline-flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)' }}
                >
                  <Phone size={12} />
                  {restaurant.phone}
                </a>
              )}
              {restaurant.website && (
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)' }}
                >
                  <Globe size={12} />
                  Website
                </a>
              )}
              {restaurant.instagram_handle && (
                <a
                  href={
                    restaurant.instagram_url ??
                    `https://www.instagram.com/${restaurant.instagram_handle}/`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-white px-2.5 py-1"
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)',
                    borderRadius: '6px',
                    fontWeight: 500,
                  }}
                >
                  @{restaurant.instagram_handle}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accolades Banner */}
      {hasAccolades && (
        <div
          className="border-b"
          style={{
            backgroundColor: 'rgba(212,165,116,0.08)',
            borderColor: 'rgba(212,165,116,0.2)',
          }}
        >
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4">
            <AccoladesBadges restaurant={restaurant} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">
          {/* Main column */}
          <div className="space-y-9">
            {/* Ratings Scoreboard */}
            <section>
              <h2
                className="text-lg mb-3.5"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}
              >
                Ratings Dashboard
              </h2>
              <div
                className="grid grid-cols-3 overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                }}
              >
                {scoreSources.map((source, i) => (
                  <ScoreCell key={source.key} source={source} last={i === scoreSources.length - 1} />
                ))}
              </div>
            </section>

            {/* Signature Dishes — surfaced from restaurant_highlighted_dishes.
                Extractor currently yields cuisine-level tokens; we present
                them as "what reviewers mention" rather than menu items so
                the label doesn't over-promise the data quality. */}
            {dishes.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3.5">
                  <h2
                    className="text-lg"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                    }}
                  >
                    What Reviewers Mention
                  </h2>
                  <span
                    className="text-xs"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Top {dishes.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dishes.map((dish) => (
                    <span
                      key={dish.name}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '999px',
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>
                        {dish.name}
                      </span>
                      {dish.count > 0 && (
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {dish.count}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* On Social */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <h2
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 500,
                    fontSize: '18px',
                    color: 'var(--color-text)',
                  }}
                >
                  On Social
                </h2>
                <span
                  className="text-xs"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {videoCount > 0
                    ? `${videoCount} video${videoCount !== 1 ? 's' : ''}`
                    : 'TikTok & Instagram'}
                </span>
              </div>
              <VideoGallery restaurantId={restaurant.id} />
            </section>

            {/* The Story */}
            {restaurant.description && (
              <section>
                <h2
                  className="text-lg mb-3.5"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  The Story
                </h2>
                <p
                  className="text-sm leading-relaxed italic"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 300,
                    lineHeight: 1.7,
                  }}
                >
                  {restaurant.description}
                </p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Map with "View on Google Maps" click-through (design v2) */}
            {restaurant.latitude && restaurant.longitude && (
              <div
                className="overflow-hidden"
                style={{
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <div className="aspect-video bg-gray-100">
                  <iframe
                    title="Restaurant location"
                    src={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=15&output=embed`}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                {(restaurant.google_url ||
                  (restaurant.latitude && restaurant.longitude)) && (
                  <a
                    href={
                      restaurant.google_url ||
                      `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 text-xs uppercase transition-colors"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      fontWeight: 500,
                      color: 'var(--color-accent)',
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    View on Google Maps
                  </a>
                )}
              </div>
            )}

            {/* Similar Restaurants */}
            {relatedRestaurants.length > 0 && (
              <div>
                <h3
                  className="text-sm mb-3"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  Similar Restaurants
                </h3>
                <div className="space-y-3">
                  {relatedRestaurants.map((related) => (
                    <RestaurantCard key={related.id} restaurant={related} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScoreCell({ source, last }: { source: ScoreSource; last: boolean }) {
  const hasRating = source.rating != null

  return (
    <div
      className="flex flex-col items-center justify-center py-5 px-3 text-center"
      style={{
        borderRight: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <div
        className="w-[22px] h-[22px] flex items-center justify-center mb-2"
        style={{
          borderRadius: '4px',
          backgroundColor: source.badgeBg,
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {source.icon}
      </div>
      <span
        className="text-[10px] uppercase mb-1"
        style={{
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.1em',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}
      >
        {source.label}
      </span>
      {hasRating ? (
        <>
          <span
            className="text-xl"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {source.rating!.toFixed(1)}
          </span>
          <span
            className="text-[10px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
            }}
          >
            / {source.maxRating}
          </span>
          {source.reviewCount != null && source.reviewCount > 0 && (
            <span
              className="text-[10px] mt-0.5"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {source.reviewCount.toLocaleString()} reviews
            </span>
          )}
        </>
      ) : (
        <span
          className="text-xl"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
          }}
        >
          —
        </span>
      )}
    </div>
  )
}
