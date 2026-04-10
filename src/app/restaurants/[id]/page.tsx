import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import ReviewStats from '@/components/ReviewStats'
import RatingBadge from '@/components/RatingBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ExternalLink, UtensilsCrossed, PenSquare } from 'lucide-react'

export const revalidate = 60

async function getRestaurantData(restaurantId: string) {
  const supabase = await createServerSupabaseClient()

  const [restaurantRes, reviewsRes] = await Promise.all([
    supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
    supabase.from('reviews').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
  ])

  if (restaurantRes.error || !restaurantRes.data) {
    return null
  }

  const reviewsWithData = await Promise.all(
    (reviewsRes.data || []).map(async (review) => {
      const [author, photos] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', review.author_id).single(),
        supabase.from('review_photos').select('*').eq('review_id', review.id),
      ])
      return { review, author: author.data, photos: photos.data || [] }
    })
  )

  const { data: relatedRestaurants } = await supabase
    .from('restaurants')
    .select('*')
    .eq('cuisine', restaurantRes.data.cuisine)
    .neq('id', restaurantId)
    .order('avg_rating', { ascending: false })
    .limit(3)

  return {
    restaurant: restaurantRes.data,
    reviews: reviewsWithData.filter((item) => item.author),
    relatedRestaurants: relatedRestaurants || [],
  }
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getRestaurantData(id)

  if (!data) {
    notFound()
  }

  const { restaurant, reviews, relatedRestaurants } = data
  const priceDisplay = '$'.repeat(restaurant.price_range)
  const ratingBreakdown = reviews.map((r) => r.review.rating)

  const hasExternalRatings = (restaurant.google_rating && restaurant.google_url) || (restaurant.yelp_rating && restaurant.yelp_url) || (restaurant.beli_score && restaurant.beli_url)

  return (
    <div className="min-h-screen">
      {/* Full-width Header */}
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <Link
            href="/restaurants"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-4 inline-block"
          >
            &larr; All restaurants
          </Link>

          <div className="flex items-start gap-5">
            {/* Photo placeholder */}
            <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-white border border-gray-100 items-center justify-center shadow-sm flex-shrink-0">
              <UtensilsCrossed size={28} className="text-emerald-300" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    {restaurant.name}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded-md text-xs font-medium text-gray-600 border border-gray-100">
                      {restaurant.cuisine}
                    </span>
                    <span className="text-gray-300">&middot;</span>
                    <span>{priceDisplay}</span>
                    <span className="text-gray-300">&middot;</span>
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin size={13} className="text-gray-400" />
                      {restaurant.city}
                    </span>
                  </p>
                  {restaurant.address && (
                    <p className="text-sm text-gray-400 mt-1">{restaurant.address}</p>
                  )}
                </div>
                <RatingBadge rating={restaurant.avg_rating || 0} size="lg" />
              </div>

              <p className="text-xs text-gray-400 mt-2">
                {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>

          {/* External Ratings */}
          {hasExternalRatings && (
            <div className="flex gap-2 flex-wrap mt-5">
              {restaurant.google_rating != null && Number(restaurant.google_rating) > 0 && restaurant.google_url && (
                <a href={restaurant.google_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-sm shadow-sm">
                  <span className="w-5 h-5 bg-blue-500 rounded text-white text-xs font-bold flex items-center justify-center">G</span>
                  <span className="font-semibold text-gray-900">{Number(restaurant.google_rating).toFixed(1)}</span>
                  <ExternalLink size={12} className="text-gray-400" />
                </a>
              )}
              {restaurant.yelp_rating != null && Number(restaurant.yelp_rating) > 0 && restaurant.yelp_url && (
                <a href={restaurant.yelp_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-sm shadow-sm">
                  <span className="w-5 h-5 bg-red-500 rounded text-white text-xs font-bold flex items-center justify-center">Y</span>
                  <span className="font-semibold text-gray-900">{Number(restaurant.yelp_rating).toFixed(1)}</span>
                  <ExternalLink size={12} className="text-gray-400" />
                </a>
              )}
              {restaurant.beli_score != null && Number(restaurant.beli_score) > 0 && restaurant.beli_url && (
                <a href={restaurant.beli_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-sm shadow-sm">
                  <span className="w-5 h-5 bg-purple-500 rounded text-white text-xs font-bold flex items-center justify-center">B</span>
                  <span className="font-semibold text-gray-900">{Number(restaurant.beli_score).toFixed(0)}</span>
                  <ExternalLink size={12} className="text-gray-400" />
                </a>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-5">
            <Link
              href={`/restaurants/${restaurant.id}/review`}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium text-sm inline-flex items-center gap-2 shadow-sm"
            >
              <PenSquare size={15} />
              Write a Review
            </Link>
            {restaurant.website && (
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-1.5 shadow-sm"
              >
                <Globe size={15} />
                Website
              </a>
            )}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-1.5 shadow-sm"
              >
                <Phone size={15} />
                Call
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main Content — 2-column layout on desktop */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column — Reviews */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-gray-900">
              {reviews.length > 0
                ? `Reviews (${reviews.length})`
                : 'No reviews yet'}
            </h2>

            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map(({ review, author, photos }) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    restaurant={restaurant}
                    author={author}
                    photos={photos}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                <PenSquare size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">Be the first to review this restaurant!</p>
                <Link
                  href={`/restaurants/${restaurant.id}/review`}
                  className="inline-block px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                >
                  Write a Review
                </Link>
              </div>
            )}
          </div>

          {/* Right column — Sidebar */}
          <div className="space-y-6">
            {/* Rating Breakdown */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 sticky top-20">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Rating Breakdown</h3>
                <ReviewStats
                  ratings={ratingBreakdown}
                  totalReviews={reviews.length}
                  averageRating={restaurant.avg_rating || 0}
                />
              </div>
            )}

            {/* Related Restaurants */}
            {relatedRestaurants.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">More {restaurant.cuisine}</h3>
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
