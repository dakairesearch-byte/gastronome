import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import ReviewStats from '@/components/ReviewStats'
import RatingBadge from '@/components/RatingBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ExternalLink } from 'lucide-react'

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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">

        {/* Restaurant Header */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <RatingBadge rating={restaurant.avg_rating || 0} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {restaurant.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {restaurant.cuisine} &middot; {priceDisplay} &middot;{' '}
                <span className="inline-flex items-center gap-0.5">
                  <MapPin size={13} className="text-gray-400" />
                  {restaurant.city}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>

          {restaurant.address && (
            <p className="text-sm text-gray-500">{restaurant.address}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Link
              href={`/restaurants/${restaurant.id}/review`}
              className="flex-1 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium text-sm text-center"
            >
              Write a Review
            </Link>
            {restaurant.website && (
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-1.5"
              >
                <Globe size={15} />
                Website
              </a>
            )}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-1.5"
              >
                <Phone size={15} />
                Call
              </a>
            )}
          </div>
        </div>

        {/* External Ratings */}
        {hasExternalRatings && (
          <div className="flex gap-2 flex-wrap">
            {restaurant.google_rating != null && Number(restaurant.google_rating) > 0 && restaurant.google_url && (
              <a href={restaurant.google_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors text-sm">
                <span className="w-5 h-5 bg-blue-500 rounded text-white text-xs font-bold flex items-center justify-center">G</span>
                <span className="font-semibold text-gray-900">{Number(restaurant.google_rating).toFixed(1)}</span>
                <ExternalLink size={12} className="text-gray-400" />
              </a>
            )}
            {restaurant.yelp_rating != null && Number(restaurant.yelp_rating) > 0 && restaurant.yelp_url && (
              <a href={restaurant.yelp_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors text-sm">
                <span className="w-5 h-5 bg-red-500 rounded text-white text-xs font-bold flex items-center justify-center">Y</span>
                <span className="font-semibold text-gray-900">{Number(restaurant.yelp_rating).toFixed(1)}</span>
                <ExternalLink size={12} className="text-gray-400" />
              </a>
            )}
            {restaurant.beli_score != null && Number(restaurant.beli_score) > 0 && restaurant.beli_url && (
              <a href={restaurant.beli_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors text-sm">
                <span className="w-5 h-5 bg-purple-500 rounded text-white text-xs font-bold flex items-center justify-center">B</span>
                <span className="font-semibold text-gray-900">{Number(restaurant.beli_score).toFixed(0)}</span>
                <ExternalLink size={12} className="text-gray-400" />
              </a>
            )}
          </div>
        )}

        {/* Review Stats */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Rating Breakdown</h2>
            <ReviewStats
              ratings={ratingBreakdown}
              totalReviews={reviews.length}
              averageRating={restaurant.avg_rating || 0}
            />
          </div>
        )}

        {/* Reviews */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {reviews.length > 0 ? 'Reviews' : 'No reviews yet'}
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
            <div className="text-center py-12 bg-white rounded-lg border border-gray-100">
              <p className="text-gray-500 mb-4">Be the first to review this restaurant!</p>
              <Link
                href={`/restaurants/${restaurant.id}/review`}
                className="inline-block px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
              >
                Write a Review
              </Link>
            </div>
          )}
        </section>

        {/* Related Restaurants */}
        {relatedRestaurants.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">More {restaurant.cuisine}</h2>
            <div className="space-y-3">
              {relatedRestaurants.map((related) => (
                <RestaurantCard key={related.id} restaurant={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
