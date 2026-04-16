import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import RestaurantCard from '@/components/RestaurantCard'
import type { Restaurant } from '@/types/database'
import AccoladesBadges, { getDesignationDisplay } from '@/components/AccoladesBadges'
import VideoGallery from '@/components/VideoGallery'
import ShareButton from '@/components/ShareButton'
import BookmarkButton from '@/components/BookmarkButton'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ExternalLink, ArrowLeft } from 'lucide-react'

export const revalidate = 60

async function getRestaurantData(restaurantId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant) return null

  // Related + videoCount don't depend on each other — run them in
  // parallel. Previously the page waterfalled three sequential
  // round-trips (restaurant, trending, videoCount); collapsing the
  // last two into a `Promise.all` shaves ~one round-trip of TTFB on
  // every detail render.
  const [trending, videoCountResult] = await Promise.all([
    topTrendingRestaurants(supabase, {
      city: restaurant.city ?? undefined,
      window: '30d',
      limit: 8,
    }),
    supabase
      .from('restaurant_videos')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
  ])

  let relatedRestaurants: Restaurant[] = trending
    .filter((r) => r.id !== restaurantId)
    .slice(0, 4)
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

  return {
    restaurant,
    relatedRestaurants,
    videoCount: videoCountResult.count ?? 0,
  }
}

type RatingSource = {
  key: 'google' | 'yelp' | 'infatuation' | 'beli'
  label: string
  icon: string
  rating: number | null
  maxRating: number
  reviewCount?: number | null
  url: string | null
  bg: string
  border: string
  accent: string
  text: string
  iconBg: string
}

function buildRatingSources(
  restaurant: NonNullable<Awaited<ReturnType<typeof getRestaurantData>>>['restaurant']
): RatingSource[] {
  return [
    {
      key: 'google',
      label: 'Google',
      icon: 'G',
      rating: restaurant.google_rating,
      maxRating: 5,
      reviewCount: restaurant.google_review_count,
      url: restaurant.google_url,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      accent: 'text-blue-700',
      text: 'text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      key: 'yelp',
      label: 'Yelp',
      icon: 'Y',
      rating: restaurant.yelp_rating,
      maxRating: 5,
      reviewCount: restaurant.yelp_review_count,
      url: restaurant.yelp_url,
      bg: 'bg-red-50',
      border: 'border-red-200',
      accent: 'text-red-700',
      text: 'text-red-600',
      iconBg: 'bg-red-100',
    },
    {
      key: 'infatuation',
      label: 'Infatuation',
      icon: 'TI',
      rating: restaurant.infatuation_rating,
      maxRating: 10,
      reviewCount: null,
      url: restaurant.infatuation_url,
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      accent: 'text-orange-700',
      text: 'text-orange-600',
      iconBg: 'bg-orange-100',
    },
    {
      key: 'beli',
      label: 'Beli',
      icon: 'B',
      rating: restaurant.beli_score,
      maxRating: 10,
      reviewCount: null,
      url: restaurant.beli_url,
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      accent: 'text-purple-700',
      text: 'text-purple-600',
      iconBg: 'bg-purple-100',
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

  const { restaurant, relatedRestaurants, videoCount } = data
  const ratingSources = buildRatingSources(restaurant)
  const hasAccolades = restaurant.michelin_stars > 0 || restaurant.michelin_designation || restaurant.james_beard_winner || restaurant.james_beard_nominated || restaurant.eater_38
  const photoUrl = restaurant.photo_url || restaurant.google_photo_url
  const trackedCount = ratingSources.filter((s) => s.rating != null).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={restaurant.name}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/50 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white font-medium transition-colors"
            >
              <ArrowLeft size={14} />
              Discover
            </Link>
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
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {restaurant.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-gray-300">
              {restaurant.cuisine && (
                <span className="px-2.5 py-0.5 bg-white/10 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-200 border border-white/10">
                  {restaurant.cuisine}
                </span>
              )}
              <span className="text-gray-500">&middot;</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {restaurant.neighborhood || restaurant.city}
              </span>
            </div>
            {restaurant.address && (
              <p className="text-sm text-gray-400 mt-2">
                {restaurant.google_url ? (
                  <a href={restaurant.google_url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
                    {restaurant.address} <ExternalLink size={11} className="inline -mt-0.5 ml-0.5" />
                  </a>
                ) : (
                  restaurant.address
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Accolades Banner */}
      {hasAccolades && (
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-b border-amber-200/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <AccoladesBadges restaurant={restaurant} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Ratings Dashboard */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Ratings Dashboard</h2>
                <span className="text-xs text-gray-400">{trackedCount} of 4 sources tracked</span>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {ratingSources.map((source) => (
                  <DashboardCard key={source.key} source={source} />
                ))}
              </div>

              {restaurant.infatuation_review_snippet && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <blockquote className="text-sm text-gray-700 italic leading-relaxed">
                    &ldquo;{restaurant.infatuation_review_snippet}&rdquo;
                  </blockquote>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-semibold text-gray-500">&mdash; The Infatuation</span>
                    {restaurant.infatuation_url && (
                      <a
                        href={restaurant.infatuation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Read full review <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* On Social — TikTok + Instagram Video Gallery */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">On Social</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Videos from TikTok &amp; Instagram</p>
                </div>
                <span className="text-xs text-gray-400">
                  {videoCount > 0
                    ? `${videoCount} video${videoCount !== 1 ? 's' : ''}`
                    : 'TikTok & Instagram'}
                </span>
              </div>
              <VideoGallery restaurantId={restaurant.id} />
            </section>

            {/* Description */}
            {restaurant.description && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{restaurant.description}</p>
              </section>
            )}

          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Map */}
            {restaurant.latitude && restaurant.longitude && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="aspect-[4/3] bg-gray-100">
                  <iframe
                    title="Restaurant location"
                    src={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=15&output=embed`}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            )}

            {/* Contact Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Details</h3>
              {restaurant.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>{restaurant.address}</span>
                </div>
              )}
              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors"
                >
                  <Phone size={15} className="text-gray-400 flex-shrink-0" />
                  {restaurant.phone}
                </a>
              )}
              {restaurant.website && (
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <Globe size={15} className="flex-shrink-0" />
                  Visit website
                  <ExternalLink size={11} />
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
                  className="flex items-center gap-2 text-sm text-pink-600 hover:text-pink-700 transition-colors"
                >
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-sm bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 text-white text-[9px] font-bold flex-shrink-0"
                  >
                    IG
                  </span>
                  View on Instagram
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            {/* More in City */}
            {relatedRestaurants.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">More in {restaurant.city}</h3>
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

function DashboardCard({ source }: { source: RatingSource }) {
  const hasRating = source.rating != null
  const Wrapper = hasRating && source.url ? 'a' : 'div'
  const wrapperProps =
    hasRating && source.url
      ? { href: source.url, target: '_blank' as const, rel: 'noopener noreferrer' }
      : {}

  if (!hasRating) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
        <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-gray-100 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-400">{source.icon}</span>
        </div>
        <p className="text-xs font-bold uppercase text-gray-400 tracking-wide">{source.label}</p>
        <p className="text-3xl font-extrabold text-gray-300 mt-1">&mdash;</p>
        <p className="text-xs text-gray-400 mt-1.5">Not yet tracked</p>
      </div>
    )
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={`${source.bg} rounded-xl p-4 text-center border ${source.border} transition-colors group block`}
    >
      <div className={`w-8 h-8 mx-auto mb-2 rounded-lg ${source.iconBg} flex items-center justify-center`}>
        <span className={`text-xs font-bold ${source.accent}`}>{source.icon}</span>
      </div>
      <p className="text-xs font-bold uppercase text-gray-500 tracking-wide">{source.label}</p>
      <p className={`text-3xl font-extrabold ${source.accent} mt-1`}>
        {source.rating!.toFixed(1)}
      </p>
      <p className={`text-xs ${source.text} mt-0.5`}>/ {source.maxRating}</p>
      {source.reviewCount != null && source.reviewCount > 0 ? (
        <p className="text-xs text-gray-400 mt-1.5">
          {source.reviewCount.toLocaleString()} {source.reviewCount === 1 ? 'review' : 'reviews'}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5">Rated</p>
      )}
      {source.url && (
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 group-hover:text-gray-600 mt-2 transition-colors">
          View source <ExternalLink size={9} />
        </span>
      )}
    </Wrapper>
  )
}
