import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import RestaurantCard from '@/components/RestaurantCard'
import type { Restaurant } from '@/types/database'
import AccoladesBadges from '@/components/AccoladesBadges'
import VideoGallery from '@/components/VideoGallery'
import ShareButton from '@/components/ShareButton'
import BookmarkButton from '@/components/BookmarkButton'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, Star, ThumbsUp } from 'lucide-react'
import BackButton from '@/components/BackButton'
import { GoogleGIcon } from '@/components/brands/BrandIcons'
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
        .select(
          'dish_name, mention_count, rank, google_mentions, tiktok_mentions, instagram_mentions, other_mentions, avg_rating, rating_sample_size, positive_pct, sentiment_sample_size, sample_quote'
        )
        .eq('restaurant_id', restaurantId)
        .order('rank', { ascending: true, nullsFirst: false })
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
  // Each dish now carries source-split mention counts plus optional
  // rating/sentiment rollups so the UI can show a confidence chip
  // alongside the name.
  type RawDish = {
    dish_name: string | null
    mention_count: number | null
    rank: number | null
    google_mentions: number | null
    tiktok_mentions: number | null
    instagram_mentions: number | null
    other_mentions: number | null
    avg_rating: number | null
    rating_sample_size: number | null
    positive_pct: number | null
    sentiment_sample_size: number | null
    sample_quote: string | null
  }
  const rawDishes = (dishesResult.data ?? []) as RawDish[]
  const seen = new Set<string>()
  const dishes: Array<{
    name: string
    count: number
    google: number
    tiktok: number
    instagram: number
    other: number
    avgRating: number | null
    ratingSample: number
    positivePct: number | null
    sentimentSample: number
    sampleQuote: string | null
  }> = []
  for (const d of rawDishes) {
    const name = (d.dish_name ?? '').trim()
    if (!name || name.length < 2) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    dishes.push({
      name,
      count: d.mention_count ?? 0,
      google: d.google_mentions ?? 0,
      tiktok: d.tiktok_mentions ?? 0,
      instagram: d.instagram_mentions ?? 0,
      other: d.other_mentions ?? 0,
      avgRating: d.avg_rating ?? null,
      ratingSample: d.rating_sample_size ?? 0,
      positivePct: d.positive_pct ?? null,
      sentimentSample: d.sentiment_sample_size ?? 0,
      sampleQuote: d.sample_quote ?? null,
    })
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
  const all: ScoreSource[] = [
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
  // Only surface sources that have a rating. An empty cell with a dash
  // looks like a data bug and makes the comparison row feel broken —
  // users have reported it as "this restaurant has no Infatuation page".
  return all.filter((s) => s.rating != null)
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
            alt={`${restaurant.name} hero`}
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
            {/* Ratings Scoreboard — hidden entirely when no source has a
                rating, so a brand-new restaurant page doesn't render an
                empty dashboard box. */}
            {scoreSources.length > 0 && (
              <section>
                <div className="mb-3.5">
                  <span
                    className="text-xs uppercase block mb-2.5"
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.18em',
                      fontWeight: 500,
                    }}
                  >
                    Aggregated Reviews
                  </span>
                  <h2
                    className="text-2xl"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    Ratings Dashboard
                  </h2>
                  <div
                    className="mt-3.5"
                    style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
                <div
                  className="grid overflow-hidden"
                  style={{
                    gridTemplateColumns: `repeat(${scoreSources.length}, minmax(0, 1fr))`,
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
            )}

            {/* Signature Dishes — sourced from restaurant_highlighted_dishes,
                which unions LLM-extracted mentions from TikTok captions,
                Instagram captions, and Google / external reviews. Each dish
                carries a sentiment/rating rollup (★ avg from Google reviews
                when we have ≥3 ratings, otherwise a 👍 positive-share from
                LLM sentiment when we have ≥3 sentiment samples) plus a
                source-split indicator strip, so the UI reflects *which*
                reviewers are talking about *which* dishes. */}
            {dishes.length > 0 && (
              <section>
                <div className="mb-3.5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span
                        className="text-xs uppercase block mb-2.5"
                        style={{
                          color: 'var(--color-accent)',
                          fontFamily: 'var(--font-body)',
                          letterSpacing: '0.18em',
                          fontWeight: 500,
                        }}
                      >
                        Across reviews &amp; social
                      </span>
                      <h2
                        className="text-2xl"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          letterSpacing: '-0.005em',
                        }}
                      >
                        What Reviewers Mention
                      </h2>
                    </div>
                    <span
                      className="text-[11px] uppercase pb-1"
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.14em',
                      }}
                    >
                      Top {dishes.length}
                    </span>
                  </div>
                  <div
                    className="mt-3.5"
                    style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {dishes.map((dish) => {
                    // Prefer a ★ rating chip when we have enough Google
                    // rating samples (≥3), otherwise fall back to a 👍
                    // positive-share chip from LLM sentiment (≥3 samples).
                    // Below that floor we show nothing — a single
                    // "positive" mention is not a confidence signal.
                    const hasRating =
                      dish.avgRating !== null && dish.ratingSample >= 3
                    const hasSentiment =
                      dish.positivePct !== null && dish.sentimentSample >= 3
                    const ratingChip = hasRating ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px]"
                        style={{
                          backgroundColor: 'rgba(234,179,8,0.12)',
                          color: '#a16207',
                          borderRadius: '999px',
                          padding: '2px 7px',
                          fontWeight: 500,
                        }}
                        title={`${dish.ratingSample} Google review${dish.ratingSample !== 1 ? 's' : ''} mentioned this`}
                      >
                        <Star
                          size={10}
                          fill="#ca8a04"
                          stroke="#ca8a04"
                        />
                        {dish.avgRating!.toFixed(1)}
                      </span>
                    ) : hasSentiment ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px]"
                        style={{
                          backgroundColor:
                            dish.positivePct! >= 70
                              ? 'rgba(22,163,74,0.12)'
                              : dish.positivePct! >= 40
                              ? 'rgba(148,163,184,0.15)'
                              : 'rgba(220,38,38,0.12)',
                          color:
                            dish.positivePct! >= 70
                              ? '#15803d'
                              : dish.positivePct! >= 40
                              ? '#475569'
                              : '#b91c1c',
                          borderRadius: '999px',
                          padding: '2px 7px',
                          fontWeight: 500,
                        }}
                        title={`${Math.round(dish.positivePct!)}% positive across ${dish.sentimentSample} mention${dish.sentimentSample !== 1 ? 's' : ''}`}
                      >
                        <ThumbsUp size={10} />
                        {Math.round(dish.positivePct!)}%
                      </span>
                    ) : null
                    return (
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
                        title={dish.sampleQuote ?? undefined}
                      >
                        <span style={{ fontWeight: 500 }}>{dish.name}</span>
                        {ratingChip}
                        {(dish.google > 0 ||
                          dish.tiktok > 0 ||
                          dish.instagram > 0) && (
                          <span
                            className="inline-flex items-center gap-1"
                            style={{ opacity: 0.85 }}
                          >
                            {dish.google > 0 && (
                              <GoogleGIcon
                                size={11}
                                title={`${dish.google} Google mention${dish.google !== 1 ? 's' : ''}`}
                              />
                            )}
                            {dish.tiktok > 0 && (
                              <span
                                className="inline-flex items-center justify-center text-[9px]"
                                style={{
                                  backgroundColor: '#000',
                                  color: '#fff',
                                  width: 14,
                                  height: 14,
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  letterSpacing: '-0.03em',
                                }}
                                title={`${dish.tiktok} TikTok mention${dish.tiktok !== 1 ? 's' : ''}`}
                              >
                                TT
                              </span>
                            )}
                            {dish.instagram > 0 && (
                              <span
                                className="inline-flex items-center justify-center text-[9px]"
                                style={{
                                  background:
                                    'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)',
                                  color: '#fff',
                                  width: 14,
                                  height: 14,
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  letterSpacing: '-0.03em',
                                }}
                                title={`${dish.instagram} Instagram mention${dish.instagram !== 1 ? 's' : ''}`}
                              >
                                IG
                              </span>
                            )}
                          </span>
                        )}
                        {dish.count > 0 && (
                          <span
                            className="text-[11px]"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {dish.count}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}

            {/* On Social */}
            <section>
              <div className="mb-3.5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <span
                      className="text-xs uppercase block mb-2.5"
                      style={{
                        color: 'var(--color-accent)',
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.18em',
                        fontWeight: 500,
                      }}
                    >
                      TikTok &amp; Instagram
                    </span>
                    <h2
                      className="text-2xl"
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 500,
                        color: 'var(--color-text)',
                        letterSpacing: '-0.005em',
                      }}
                    >
                      On Social
                    </h2>
                  </div>
                  {videoCount > 0 && (
                    <span
                      className="text-[11px] uppercase pb-1"
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.14em',
                      }}
                    >
                      {videoCount} video{videoCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div
                  className="mt-3.5"
                  style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
                />
              </div>
              <VideoGallery restaurantId={restaurant.id} />
            </section>

            {/* The Story */}
            {restaurant.description && (
              <section>
                <div className="mb-3.5">
                  <span
                    className="text-xs uppercase block mb-2.5"
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.18em',
                      fontWeight: 500,
                    }}
                  >
                    About
                  </span>
                  <h2
                    className="text-2xl"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    The Story
                  </h2>
                  <div
                    className="mt-3.5"
                    style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
                <p
                  className="italic"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 300,
                    fontSize: '18px',
                    lineHeight: 1.65,
                    maxWidth: '44rem',
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
                  className="text-[11px] uppercase mb-4 pb-3"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    letterSpacing: '0.14em',
                    borderBottom: '1px solid var(--color-border)',
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

  const wrapper = source.url ? 'a' : 'div'
  const linkProps = source.url
    ? { href: source.url, target: '_blank' as const, rel: 'noopener noreferrer' as const }
    : {}

  const Tag = wrapper as React.ElementType

  return (
    <Tag
      {...linkProps}
      className="block py-5 px-4 transition-colors"
      style={{
        borderRight: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-[22px] h-[22px] flex items-center justify-center flex-shrink-0"
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
          className="text-[10px] uppercase"
          style={{
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {source.label}
        </span>
      </div>
      {hasRating ? (
        <>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.875rem',
              fontWeight: 500,
              lineHeight: 1,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {source.rating!.toFixed(1)}
            <span
              style={{
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                fontWeight: 400,
                marginLeft: '2px',
              }}
            >
              /{source.maxRating}
            </span>
          </div>
          {source.reviewCount != null && source.reviewCount > 0 && (
            <span
              className="text-[11px] mt-1.5 block"
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
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.875rem',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
          }}
        >
          —
        </span>
      )}
    </Tag>
  )
}
