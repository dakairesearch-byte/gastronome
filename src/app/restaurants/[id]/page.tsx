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
import Breadcrumb from '@/components/Breadcrumb'
import GastronomeScoreBadge from '@/components/GastronomeScoreBadge'
import StaticMapTile from '@/components/StaticMapTile'
import { gastronomeScore } from '@/lib/score'
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
    {
      // Beli feeds the Gastronome Score (weight 0.2 in score.ts), so it
      // belongs in the receipts row alongside the other contributing
      // sources. Beli scores are already on a /10 scale.
      key: 'beli',
      label: 'Beli',
      icon: 'B',
      rating: restaurant.beli_score,
      maxRating: 10,
      reviewCount: null,
      url: restaurant.beli_url,
      badgeBg: '#E0E7FF',
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
  // Compute the Gastronome Score once — it was previously recomputed three
  // times in the hero (gate + render + non-null assertion), each rebuilding
  // the full breakdown array.
  const score = gastronomeScore(restaurant)
  // `james_beard_nominated` was dropped — only the winner flag participates.
  const hasAccolades =
    restaurant.michelin_stars > 0 ||
    !!restaurant.michelin_designation ||
    restaurant.james_beard_winner ||
    restaurant.eater_38
  const photoUrl = restaurant.photo_url || restaurant.google_photo_url

  // DT1 decision-bar inputs ------------------------------------------------
  // Price tier: price_range is a 1–4 integer from Google Places; anything
  // outside that range (incl. 0/null) means "unknown" → render nothing.
  const priceTier =
    restaurant.price_range >= 1 && restaurant.price_range <= 4
      ? '$'.repeat(restaurant.price_range)
      : null
  // Open/closed status from the lifecycle column. We only surface a chip for
  // the two states a diner can act on; OPERATIONAL is the happy path,
  // CLOSED_* is a hard stop. Unknown/null → no chip (avoid false signal).
  const status = restaurant.business_status
  const isPermanentlyClosed = status === 'CLOSED_PERMANENTLY'
  const isTemporarilyClosed = status === 'CLOSED_TEMPORARILY'
  const isOperational = status === 'OPERATIONAL'

  // DT1 directions deep-link — mirrors the sidebar map logic so the
  // top-of-page "Get Directions" action always points at native Maps
  // navigation rather than the reviews page google_url resolves to.
  const hasCoords = restaurant.latitude != null && restaurant.longitude != null
  const dirDest = hasCoords
    ? `${restaurant.latitude},${restaurant.longitude}`
    : encodeURIComponent(
        restaurant.address
          ? `${restaurant.name}, ${restaurant.address}`
          : restaurant.name,
      )
  const dirPlace = restaurant.google_place_id
    ? `&destination_place_id=${restaurant.google_place_id}`
    : ''
  const decisionDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dirDest}${dirPlace}`
  const hasDecisionInfo =
    !!priceTier ||
    !!status ||
    !!restaurant.website ||
    hasCoords ||
    !!restaurant.google_url ||
    !!restaurant.google_place_id ||
    !!restaurant.address

  // DT5/DT7 photo strip — union of the primary photo + the photo_urls[]
  // backfill, de-duped, capped at 5. Only rendered when ≥2 distinct photos
  // exist so a single-photo restaurant doesn't get a one-tile "strip".
  const photoStrip = Array.from(
    new Set(
      [restaurant.photo_url, restaurant.google_photo_url, ...(restaurant.photo_urls ?? [])]
        .filter((u): u is string => !!u),
    ),
  ).slice(0, 5)

  // DT2 menu-format gate — tasting-menu temples / omakase counters don't
  // publish an a-la-carte item list, so the dish-less "Menu coming soon"
  // empty state misreads as missing data. When the format is non-a-la-carte
  // and we have a note, show the note instead.
  const isTastingFormat =
    !!restaurant.menu_format && restaurant.menu_format !== 'a_la_carte'

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          // Opacity bumped from 30% → 55% so the hero photo is actually
          // visible under the gradient — was nearly invisible (sweep v2
          // restaurant-detail + food-photography P1). The gradient below
          // still keeps the bottom-third dark enough for the title to
          // read legibly. Descriptive alt for the cuisine context that
          // accessibility specialist flagged.
          <img
            src={photoUrl}
            alt={`${restaurant.cuisine ?? 'Restaurant'} interior or signature dish at ${restaurant.name}`}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        {/* DT5: lightened hero gradient. Was from-black/85 via-black/50
            to-black/20 — a heavy near-opaque wash that buried the photo we
            had just bumped to 55% opacity. Eased to /70 → /35 → /5 so the
            food photography reads while the bottom third stays dark enough
            for the title to remain legible. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/5" />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-8 pt-4 pb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            {/* Breadcrumb replaces the bare "Back" label so deep-linked
                users see where they are (Explore › City › Restaurant)
                and can jump up a level. City links into Explore's
                case-insensitive ?city= filter. */}
            <Breadcrumb
              light
              crumbs={[
                { label: 'Explore', href: '/explore' },
                {
                  label: restaurant.city,
                  href: `/explore?city=${encodeURIComponent(restaurant.city)}`,
                },
                { label: restaurant.name },
              ]}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
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
              className="text-3xl sm:text-4xl mb-2"
              style={{
                fontFamily: 'var(--font-heading)',
                // Bumped from 500 → 700 so the restaurant name visibly
                // outweighs the "By the Numbers" h2 below — was the same
                // text-2xl @ weight-500 as section headings, collapsing
                // the hierarchy. Typography spec P1.
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {restaurant.name}
            </h1>

            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <MapPin size={13} aria-hidden="true" />
              <span style={{ fontFamily: 'var(--font-body)' }}>
                {restaurant.neighborhood || restaurant.city}
                {restaurant.address && ` · ${restaurant.address}`}
              </span>
            </div>

            {/* Gastronome Score — the unified number the product is
                named for. Replaces the old sourceless "4.3 ★" hero
                rating; the per-source breakdown still lives in the
                "By the Numbers" dashboard below as receipts. Falls back
                to nothing when no rating source exists. Sweep v2 P0 #2. */}
            {score && (
              <div className="mt-3">
                <GastronomeScoreBadge score={score} />
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

      {/* DT1 Decision bar — the "should I eat here?" action strip. Pinned
          directly under the hero so a foodie sees price, whether the place
          is open, and the two actions that matter (Website / Reserve and
          Get Directions) before scrolling. Gated as a whole on having any
          actionable info. */}
      {hasDecisionInfo && (
        <div
          className="border-b"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-3.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {priceTier && (
                <span
                  className="text-base"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}
                  title={`Price: ${'$'.repeat(restaurant.price_range)} (Google price level ${restaurant.price_range} of 4)`}
                >
                  <span style={{ color: 'var(--color-text)' }}>{priceTier}</span>
                  {restaurant.price_range < 4 && (
                    <span style={{ color: 'var(--color-border)' }}>
                      {'$'.repeat(4 - restaurant.price_range)}
                    </span>
                  )}
                </span>
              )}

              {(isOperational || isTemporarilyClosed || isPermanentlyClosed) && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    borderRadius: '999px',
                    backgroundColor: isOperational
                      ? 'rgba(22,163,74,0.12)'
                      : 'rgba(220,38,38,0.12)',
                    color: isOperational ? '#15803d' : '#b91c1c',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '999px',
                      backgroundColor: isOperational ? '#16a34a' : '#dc2626',
                    }}
                  />
                  {isOperational
                    ? 'Open'
                    : isTemporarilyClosed
                    ? 'Temporarily closed'
                    : 'Permanently closed'}
                </span>
              )}

              {/* Push actions to the right on wide screens. */}
              <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
                {restaurant.website && (
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs uppercase px-3.5 py-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-primary)',
                      color: '#fff',
                    }}
                  >
                    <Globe size={13} aria-hidden="true" />
                    Reserve / Website
                  </a>
                )}
                {(hasCoords ||
                  !!restaurant.google_url ||
                  !!restaurant.google_place_id ||
                  !!restaurant.address) && (
                  <a
                    href={decisionDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs uppercase px-3.5 py-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid var(--color-accent)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    <MapPin size={13} aria-hidden="true" />
                    Get Directions
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* DT5/DT7 photo strip — a thin secondary-tier row of additional
          photos, shown only when the union yields ≥2 distinct images so the
          hero photo isn't simply repeated. Horizontally scrollable on
          mobile. */}
      {photoStrip.length >= 2 && (
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-6">
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {photoStrip.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${restaurant.name} photo ${i + 1}`}
                loading="lazy"
                className="h-28 w-40 flex-shrink-0 object-cover"
                style={{
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">
          {/* Main column */}
          <div className="space-y-9">
            {/* DT3 Critic's Note — the Infatuation review snippet promoted to
                a leading callout. A pull-quote from a trusted critic is the
                single most persuasive "should I eat here?" signal, so it
                leads the main column rather than hiding in a tooltip. */}
            {restaurant.infatuation_review_snippet && (
              <section>
                <div
                  className="px-5 py-4"
                  style={{
                    borderLeft: '3px solid var(--color-accent)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '0 8px 8px 0',
                  }}
                >
                  <span
                    className="text-[11px] uppercase block mb-2"
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.16em',
                      fontWeight: 600,
                    }}
                  >
                    Critic&rsquo;s Note · The Infatuation
                  </span>
                  <p
                    className="italic"
                    style={{
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 400,
                      fontSize: '17px',
                      lineHeight: 1.6,
                    }}
                  >
                    &ldquo;{restaurant.infatuation_review_snippet}&rdquo;
                  </p>
                  {restaurant.infatuation_url && (
                    <a
                      href={restaurant.infatuation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2.5 text-xs uppercase tracking-wider font-medium"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Read the full review &rarr;
                    </a>
                  )}
                </div>
              </section>
            )}

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
                    By the Numbers
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
                        Signature Dishes
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
                {/* DT8: ranked list (not a chip cloud). Each row leads with
                    its rank, the dish name, the promoted inline sample quote
                    (DT3 — no longer hover-only), a "{n} mentions" count, the
                    confidence chip, and the per-source glyph strip. A glyph
                    legend below decodes the source marks once. */}
                <ol className="space-y-2.5">
                  {dishes.map((dish, idx) => {
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
                        className="inline-flex items-center gap-1 text-[11px] flex-shrink-0"
                        style={{
                          backgroundColor: 'rgba(234,179,8,0.12)',
                          color: '#a16207',
                          borderRadius: '999px',
                          padding: '2px 7px',
                          fontWeight: 500,
                        }}
                        title={`${dish.ratingSample} Google review${dish.ratingSample !== 1 ? 's' : ''} mentioned this`}
                      >
                        <Star size={10} fill="#ca8a04" stroke="#ca8a04" />
                        {dish.avgRating!.toFixed(1)}
                      </span>
                    ) : hasSentiment ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] flex-shrink-0"
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
                      <li
                        key={dish.name}
                        className="flex gap-3.5 px-4 py-3"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '10px',
                          fontFamily: 'var(--font-body)',
                          color: 'var(--color-text)',
                        }}
                      >
                        <span
                          className="flex-shrink-0 flex items-center justify-center text-sm"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '999px',
                            backgroundColor: 'var(--color-accent)',
                            color: '#fff',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                          }}
                          aria-hidden="true"
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm" style={{ fontWeight: 600 }}>
                              {dish.name}
                            </span>
                            {ratingChip}
                            {(dish.google > 0 ||
                              dish.tiktok > 0 ||
                              dish.instagram > 0) && (
                              <span className="inline-flex items-center gap-1 flex-shrink-0">
                                {dish.google > 0 && (
                                  <GoogleGIcon
                                    size={12}
                                    title={`${dish.google} Google mention${dish.google !== 1 ? 's' : ''}`}
                                  />
                                )}
                                {dish.tiktok > 0 && (
                                  <span
                                    className="inline-flex items-center justify-center text-[11px]"
                                    style={{
                                      backgroundColor: '#000',
                                      color: '#fff',
                                      width: 16,
                                      height: 16,
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
                                    className="inline-flex items-center justify-center text-[11px]"
                                    style={{
                                      background:
                                        'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)',
                                      color: '#fff',
                                      width: 16,
                                      height: 16,
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
                                className="text-[11px] ml-auto flex-shrink-0"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                {dish.count} mention{dish.count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {dish.sampleQuote && (
                            <p
                              className="italic mt-1.5 text-sm"
                              style={{
                                color: 'var(--color-text-secondary)',
                                fontFamily: 'var(--font-heading)',
                                lineHeight: 1.5,
                              }}
                            >
                              &ldquo;{dish.sampleQuote}&rdquo;
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {/* Glyph legend — decodes the per-source marks shown on each
                    dish row once, instead of relying on hover titles. Only
                    surfaces the sources actually present across the list. */}
                {(() => {
                  const anyGoogle = dishes.some((d) => d.google > 0)
                  const anyTikTok = dishes.some((d) => d.tiktok > 0)
                  const anyInsta = dishes.some((d) => d.instagram > 0)
                  if (!anyGoogle && !anyTikTok && !anyInsta) return null
                  return (
                    <div
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px]"
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <span style={{ letterSpacing: '0.08em' }}>Mentioned on</span>
                      {anyGoogle && (
                        <span className="inline-flex items-center gap-1.5">
                          <GoogleGIcon size={12} title="Google" />
                          Google reviews
                        </span>
                      )}
                      {anyTikTok && (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center justify-center text-[10px]"
                            style={{
                              backgroundColor: '#000',
                              color: '#fff',
                              width: 15,
                              height: 15,
                              borderRadius: '3px',
                              fontWeight: 700,
                            }}
                            aria-hidden="true"
                          >
                            TT
                          </span>
                          TikTok
                        </span>
                      )}
                      {anyInsta && (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center justify-center text-[10px]"
                            style={{
                              background:
                                'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)',
                              color: '#fff',
                              width: 15,
                              height: 15,
                              borderRadius: '3px',
                              fontWeight: 700,
                            }}
                            aria-hidden="true"
                          >
                            IG
                          </span>
                          Instagram
                        </span>
                      )}
                    </div>
                  )
                })()}
              </section>
            )}

            {/* Graceful empty state when no dishes have been ingested yet.
                Previously the entire section silently disappeared — for a
                Michelin restaurant with a populated profile this read as
                "we don't know this place." Now we show a one-liner that
                links to the restaurant's own website / menu when known,
                so the page never has a blank middle. Sweep v2 P0. */}
            {dishes.length === 0 && (
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
                    {isTastingFormat ? 'How they serve it' : 'Across reviews & social'}
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
                    {isTastingFormat ? 'The Menu' : 'Signature Dishes'}
                  </h2>
                  <div
                    className="mt-3.5"
                    style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
                {/* DT2: for tasting-menu / omakase / prix-fixe formats there
                    is no a-la-carte item list to gather, so the "Menu coming
                    soon" copy is actively misleading. Show the format note
                    instead — it's the accurate "what to expect" signal. */}
                <div
                  className="rounded-lg px-4 py-5 text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: isTastingFormat
                      ? '1px solid var(--color-border)'
                      : '1px dashed var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {isTastingFormat ? (
                    <p style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>
                      {restaurant.menu_note ||
                        `${restaurant.name} serves a set ${restaurant.menu_format!.replace(/_/g, ' ')} rather than an à la carte menu.`}
                    </p>
                  ) : (
                    <p>
                      Menu coming soon — our dish recommendations come from
                      reviews and social posts, and we&rsquo;re still gathering
                      them for {restaurant.name}.
                    </p>
                  )}
                  {restaurant.website && (
                    <a
                      href={restaurant.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-xs uppercase tracking-wider font-medium"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {isTastingFormat
                        ? 'See the menu & reserve →'
                        : 'View the menu on the restaurant’s site →'}
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* On Social — only renders when at least one video exists.
                Previously the section header was always shown even when
                VideoGallery had nothing to display, producing a "dead
                app" feel (sweep v2 the-critic QW: "Hide the 'On Social'
                section header until ≥1 videos load — a header over a
                near-empty section signals a dead app"). The actual gate
                is >0 since the gallery lazy-loads embeds; raising the
                threshold to 3 would suppress the section for niche
                restaurants whose sole video is genuinely a signal. */}
            {videoCount > 0 && (
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
                  </div>
                  <div
                    className="mt-3.5"
                    style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
                <VideoGallery restaurantId={restaurant.id} />
              </section>
            )}

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
                {/* Sweep 2026-05-26-v3 QW: fontWeight 300 → 400. weight-300
                    is not loaded, so browser fakes a thin weight that renders
                    blurry on low-DPI screens. */}
                <p
                  className="italic"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 400,
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
            {/* Map block.
             *
             * IFRAME GATING: render the Google Maps Embed iframe ONLY when
             * a dedicated `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` env var is
             * configured. The previous code silently fell back to the
             * Places API key, which almost never has Maps Embed API enabled
             * — so users on production saw a raw "Google Maps Platform
             * rejected your request" error rendered as page content (nine
             * sweep specialists flagged this as their most alarming
             * finding). Without the embed key we fall back to a tasteful
             * static tile + the existing Google Maps deep-link. The page
             * still works; users get an obvious link out instead of an
             * inscrutable infra error.
             *
             * Directions link uses Google Maps' `dir/?api=1&destination=`
             * URL so mobile devices open the native Maps app for turn-by-
             * turn navigation, instead of the reviews page that
             * `google_url` points to.
             */}
            {/* Map block gate: render whenever we have ANYTHING that lets us
                point a user at the place — coordinates, a Google URL, a
                place_id, or an address. Previously this required lat+lng, so
                a restaurant with a perfectly good google_url/place_id but no
                geocoded coordinates showed no map affordance and no
                Directions/View-on-Maps links at all. The iframe still needs
                coordinates or a place_id; the static fallback + deep links
                work from any of these. */}
            {(() => {
              const hasCoords =
                restaurant.latitude != null && restaurant.longitude != null
              const hasMapTarget =
                hasCoords ||
                !!restaurant.google_url ||
                !!restaurant.google_place_id ||
                !!restaurant.address
              if (!hasMapTarget) return null

              const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY
              const lat = restaurant.latitude
              const lng = restaurant.longitude

              // Build the destination component from the best available
              // identifier: coordinates → place_id → address → name.
              const coordQuery = hasCoords ? `${lat},${lng}` : ''
              const addressQuery = encodeURIComponent(
                restaurant.address
                  ? `${restaurant.name}, ${restaurant.address}`
                  : restaurant.name,
              )

              // Search ("View on Maps") uses query_place_id; directions use
              // destination_place_id — they are different Maps URL params.
              const searchPlaceParam = restaurant.google_place_id
                ? `&query_place_id=${restaurant.google_place_id}`
                : ''
              const dirPlaceParam = restaurant.google_place_id
                ? `&destination_place_id=${restaurant.google_place_id}`
                : ''

              const viewUrl =
                restaurant.google_url ||
                `https://www.google.com/maps/search/?api=1&query=${
                  coordQuery || addressQuery
                }${searchPlaceParam}`
              const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${
                coordQuery || addressQuery
              }${dirPlaceParam}`

              // DT9 / W0: the static map tile now routes through the shared
              // StaticMapTile component (also used by the Discover/map work).
              // Unlike the Embed iframe, Static Maps is enabled on the
              // existing Places key, so it renders a real map tile without the
              // dedicated Embed key. StaticMapTile returns null when lat/lng
              // are missing OR the key is unset — in which case we fall back to
              // the gradient "neighborhood + pin" panel below. The deep links
              // work regardless of which branch renders.
              const staticTile = (
                <StaticMapTile
                  lat={lat}
                  lng={lng}
                  label={`Map showing the location of ${restaurant.name}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )

              return (
                <div
                  className="overflow-hidden"
                  style={{
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  {/* The embed iframe needs a place_id or coordinates to
                      render a real map; without either (address/url only)
                      we skip straight to the static fallback so we never
                      emit a `center=null,null` view embed. */}
                  {embedKey && (restaurant.google_place_id || hasCoords) ? (
                    <div
                      className="aspect-square"
                      style={{ backgroundColor: 'var(--color-border)' }}
                    >
                      <iframe
                        title={`Map of ${restaurant.name}`}
                        src={
                          restaurant.google_place_id
                            ? `https://www.google.com/maps/embed/v1/place?key=${embedKey}&q=place_id:${restaurant.google_place_id}`
                            : `https://www.google.com/maps/embed/v1/view?key=${embedKey}&center=${lat},${lng}&zoom=15`
                        }
                        className="w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                      />
                    </div>
                  ) : hasCoords &&
                    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ? (
                    // DT9 / W0: Google Static Maps tile (shared StaticMapTile)
                    // — a real map image that links out to the full
                    // interactive map. Replaces the flat gradient "dead map"
                    // panel whenever we have coords and the Places key. If the
                    // tile 403s it just fails gracefully as a broken img.
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square relative group"
                      aria-label={`Open ${restaurant.name} on Google Maps`}
                    >
                      {staticTile}
                      <span
                        className="absolute bottom-2 right-2 text-[10px] uppercase tracking-wider px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          fontFamily: 'var(--font-body)',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          borderRadius: '4px',
                        }}
                      >
                        Open in Maps →
                      </span>
                    </a>
                  ) : (
                    // Static fallback when no embed key AND no coordinates —
                    // no network call, no iframe, no chance of the Maps API
                    // error leaking onto the page. The neighborhood +
                    // pin act as a recognizable map-shaped affordance.
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square relative group"
                      style={{
                        background:
                          'linear-gradient(135deg, #e9eef3 0%, #d6dde6 100%)',
                      }}
                      aria-label={`Open ${restaurant.name} on Google Maps`}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                        <span
                          className="text-3xl"
                          style={{ color: 'var(--color-secondary)' }}
                          aria-hidden="true"
                        >
                          📍
                        </span>
                        {restaurant.neighborhood && (
                          <span
                            className="text-sm font-semibold"
                            style={{
                              fontFamily: 'var(--font-heading)',
                              color: 'var(--color-secondary)',
                            }}
                          >
                            {restaurant.neighborhood}
                          </span>
                        )}
                        <span
                          className="text-xs uppercase tracking-wider opacity-80 group-hover:opacity-100"
                          style={{
                            fontFamily: 'var(--font-body)',
                            color: 'var(--color-secondary)',
                          }}
                        >
                          Open in Google Maps →
                        </span>
                      </div>
                    </a>
                  )}

                  <div
                    className="grid grid-cols-2 divide-x"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 text-xs uppercase transition-colors"
                      style={{
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.1em',
                        fontWeight: 500,
                        color: 'var(--color-accent)',
                      }}
                    >
                      Get Directions
                    </a>
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 text-xs uppercase transition-colors"
                      style={{
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.1em',
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      View on Maps
                    </a>
                  </div>
                </div>
              )
            })()}

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
