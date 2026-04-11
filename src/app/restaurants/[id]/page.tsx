import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/RestaurantCard'
import SourceRatingsBar from '@/components/SourceRatingsBar'
import { getSourceRatings } from '@/components/SourceRatingsBar'
import AccoladesBadges from '@/components/AccoladesBadges'
import VideoGallery from '@/components/VideoGallery'
import ComingSoon from '@/components/ComingSoon'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ExternalLink, UtensilsCrossed, ArrowLeft } from 'lucide-react'

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
  const sourceRatings = getSourceRatings(restaurant)
  const hasAccolades = restaurant.michelin_stars > 0 || restaurant.michelin_designation || restaurant.james_beard_winner || restaurant.james_beard_nominated || restaurant.eater_38

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
        {restaurant.photo_url && (
          <img
            src={restaurant.photo_url}
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
              <span>{priceDisplay}</span>
              <span className="text-gray-500">&middot;</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {restaurant.neighborhood || restaurant.city}
              </span>
            </div>
            {restaurant.address && (
              <p className="text-sm text-gray-400 mt-2">{restaurant.address}</p>
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
            {/* Ratings Panel */}
            {sourceRatings.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Ratings Across the Web</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sourceRatings.map((source) => (
                    <RatingCard key={source.source} source={source} />
                  ))}
                </div>
              </div>
            )}

            {/* Infatuation Snippet */}
            {restaurant.infatuation_review_snippet && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-orange-800 mb-2">The Infatuation says</p>
                <p className="text-sm text-orange-900 italic leading-relaxed">
                  &ldquo;{restaurant.infatuation_review_snippet}&rdquo;
                </p>
                {restaurant.infatuation_url && (
                  <a
                    href={restaurant.infatuation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium mt-2"
                  >
                    Read full review <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {/* Video Gallery */}
            {videoCount > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Videos ({videoCount})
                </h2>
                <VideoGallery restaurantId={restaurant.id} />
              </div>
            )}

            {/* Description */}
            {restaurant.description && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{restaurant.description}</p>
              </div>
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

            {/* Related Restaurants */}
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

function RatingCard({ source }: { source: import('@/types/database').SourceRating }) {
  const colorMap: Record<string, { bg: string; accent: string; text: string }> = {
    google: { bg: 'bg-blue-50', accent: 'text-blue-700', text: 'text-blue-500' },
    yelp: { bg: 'bg-red-50', accent: 'text-red-700', text: 'text-red-500' },
    infatuation: { bg: 'bg-orange-50', accent: 'text-orange-700', text: 'text-orange-500' },
  }
  const colors = colorMap[source.source] || { bg: 'bg-gray-50', accent: 'text-gray-700', text: 'text-gray-500' }

  const Wrapper = source.url ? 'a' : 'div'
  const wrapperProps = source.url
    ? { href: source.url, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={`${colors.bg} rounded-xl p-4 text-center border border-transparent hover:border-gray-200 transition-colors group`}
    >
      <p className="text-xs font-bold uppercase text-gray-400 mb-1">{source.label}</p>
      <p className={`text-2xl font-extrabold ${colors.accent}`}>
        {source.rating}
      </p>
      <p className={`text-xs ${colors.text} mt-0.5`}>
        / {source.maxRating}
      </p>
      {source.reviewCount != null && source.reviewCount > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          {source.reviewCount.toLocaleString()} reviews
        </p>
      )}
      {source.url && (
        <ExternalLink size={11} className="mx-auto mt-2 text-gray-300 group-hover:text-gray-400 transition-colors" />
      )}
    </Wrapper>
  )
}
