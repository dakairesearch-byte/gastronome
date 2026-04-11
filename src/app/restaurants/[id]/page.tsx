import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/RestaurantCard'
import AccoladesBadges from '@/components/AccoladesBadges'
import VideoGallery from '@/components/VideoGallery'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ExternalLink, ArrowLeft, Star, Clock } from 'lucide-react'

export const revalidate = 60

async function getRestaurantData(restaurantId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant) return null

  const { data: relatedRestaurants } = await supabase
    .from('restaurants')
    .select('*')
    .eq('city', restaurant.city)
    .neq('id', restaurantId)
    .order('google_rating', { ascending: false })
    .limit(4)

  const { count: videoCount } = await supabase
    .from('restaurant_videos')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  return {
    restaurant,
    relatedRestaurants: relatedRestaurants || [],
    videoCount: videoCount || 0,
  }
}

type RatingSource = {
  key: string
  label: string
  rating: number
  maxRating: number
  reviewCount?: number | null
  reviewLabel: string
  url: string | null
  bg: string
  accent: string
  text: string
  border: string
}

function buildRatingSources(restaurant: NonNullable<Awaited<ReturnType<typeof getRestaurantData>>>['restaurant']): RatingSource[] {
  const sources: RatingSource[] = []

  if (restaurant.google_rating != null) {
    sources.push({
      key: 'google',
      label: 'Google',
      rating: restaurant.google_rating,
      maxRating: 5,
      reviewCount: restaurant.google_review_count,
      reviewLabel: 'reviews',
      url: restaurant.google_url,
      bg: 'bg-blue-50',
      accent: 'text-[#4285F4]',
      text: 'text-blue-500',
      border: 'hover:border-blue-200',
    })
  }

  if (restaurant.yelp_rating != null) {
    sources.push({
      key: 'yelp',
      label: 'Yelp',
      rating: restaurant.yelp_rating,
      maxRating: 5,
      reviewCount: restaurant.yelp_review_count,
      reviewLabel: 'reviews',
      url: restaurant.yelp_url,
      bg: 'bg-red-50',
      accent: 'text-[#D32323]',
      text: 'text-red-500',
      border: 'hover:border-red-200',
    })
  }

  if (restaurant.infatuation_rating != null) {
    sources.push({
      key: 'infatuation',
      label: 'The Infatuation',
      rating: restaurant.infatuation_rating,
      maxRating: 10,
      reviewCount: null,
      reviewLabel: 'Editorial',
      url: restaurant.infatuation_url,
      bg: 'bg-gray-50',
      accent: 'text-gray-900',
      text: 'text-gray-500',
      border: 'hover:border-gray-300',
    })
  }

  if (restaurant.michelin_stars > 0 || restaurant.michelin_designation) {
    sources.push({
      key: 'michelin',
      label: 'Michelin',
      rating: restaurant.michelin_stars,
      maxRating: 3,
      reviewCount: null,
      reviewLabel: restaurant.michelin_designation || `${restaurant.michelin_stars} Star${restaurant.michelin_stars !== 1 ? 's' : ''}`,
      url: restaurant.michelin_url,
      bg: 'bg-red-50',
      accent: 'text-[#CC0000]',
      text: 'text-red-600',
      border: 'hover:border-red-200',
    })
  }

  return sources
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
  const priceDisplay = '$'.repeat(restaurant.price_range || 1)
  const ratingSources = buildRatingSources(restaurant)
  const hasAccolades = restaurant.michelin_stars > 0 || restaurant.michelin_designation || restaurant.james_beard_winner || restaurant.james_beard_nominated || restaurant.eater_38
  const photoUrl = restaurant.photo_url || restaurant.google_photo_url

  // Build review links for "What People Are Saying"
  const reviewLinks: { label: string; url: string }[] = []
  if (restaurant.google_url) reviewLinks.push({ label: 'Google Maps', url: restaurant.google_url })
  if (restaurant.yelp_url) reviewLinks.push({ label: 'Yelp', url: restaurant.yelp_url })

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
          <Link
            href="/restaurants"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white font-medium mb-6 transition-colors"
          >
            <ArrowLeft size={14} />
            All restaurants
          </Link>

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
              <span className="font-semibold text-emerald-400 font-mono">{priceDisplay}</span>
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
            {ratingSources.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Ratings Dashboard</h2>
                  {restaurant.last_fetched_at && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      Updated {new Date(restaurant.last_fetched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className={`grid gap-3 ${ratingSources.length === 1 ? 'grid-cols-1' : ratingSources.length === 2 ? 'grid-cols-2' : ratingSources.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                  {ratingSources.map((source) => (
                    <DashboardCard key={source.key} source={source} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {ratingSources.length} platform{ratingSources.length !== 1 ? 's' : ''} tracked
                </p>
              </section>
            )}

            {/* What People Are Saying */}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">What People Are Saying</h2>

              {restaurant.infatuation_review_snippet ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
                  <blockquote className="text-sm text-gray-700 italic leading-relaxed">
                    &ldquo;{restaurant.infatuation_review_snippet}&rdquo;
                  </blockquote>
                  <div className="flex items-center justify-between">
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
              ) : null}

              {reviewLinks.length > 0 && (
                <div className={`${restaurant.infatuation_review_snippet ? 'mt-3' : ''} bg-white border border-gray-200 rounded-xl p-4`}>
                  <p className="text-sm text-gray-600">
                    Read reviews on{' '}
                    {reviewLinks.map((link, i) => (
                      <span key={link.label}>
                        {i > 0 && ' or '}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          {link.label} <ExternalLink size={11} className="inline -mt-0.5" />
                        </a>
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </section>

            {/* On Social — TikTok + Instagram Video Gallery */}
            {videoCount > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">On Social</h2>
                <VideoGallery restaurantId={restaurant.id} />
              </section>
            )}

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
  const Wrapper = source.url ? 'a' : 'div'
  const wrapperProps = source.url
    ? { href: source.url, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  // Michelin uses stars display instead of numeric
  const isMichelin = source.key === 'michelin'

  return (
    <Wrapper
      {...wrapperProps}
      className={`${source.bg} rounded-xl p-4 text-center border border-transparent ${source.border} transition-colors group`}
    >
      <p className="text-xs font-bold uppercase text-gray-400 tracking-wide mb-1.5">{source.label}</p>
      {isMichelin ? (
        <div className="flex items-center justify-center gap-0.5 mb-1">
          {Array.from({ length: source.rating }).map((_, i) => (
            <Star key={i} size={18} className="fill-[#CC0000] text-[#CC0000]" />
          ))}
        </div>
      ) : (
        <>
          <p className={`text-3xl font-extrabold ${source.accent}`}>
            {source.rating}
          </p>
          <p className={`text-xs ${source.text} mt-0.5`}>
            / {source.maxRating}
          </p>
        </>
      )}
      {source.reviewCount != null && source.reviewCount > 0 ? (
        <p className="text-xs text-gray-400 mt-1.5">
          {source.reviewCount.toLocaleString()} {source.reviewLabel}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5">
          {source.reviewLabel}
        </p>
      )}
      {source.url && (
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-300 group-hover:text-gray-500 mt-2 transition-colors">
          View source <ExternalLink size={9} />
        </span>
      )}
    </Wrapper>
  )
}
