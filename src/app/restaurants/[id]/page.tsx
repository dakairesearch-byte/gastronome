import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import ReviewStats from '@/components/ReviewStats'
import StarRating from '@/components/StarRating'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ChefHat, ExternalLink } from 'lucide-react'

export const revalidate = 60

async function getRestaurantData(restaurantId: string) {
  const supabase = await createServerSupabaseClient()

  const [restaurantRes, reviewsRes] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single(),
    supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false }),
  ])

  if (restaurantRes.error || !restaurantRes.data) {
    return null
  }

  // Fetch author and photos for each review
  const reviewsWithData = await Promise.all(
    (reviewsRes.data || []).map(async (review) => {
      const [author, photos] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', review.author_id)
          .single(),
        supabase
          .from('review_photos')
          .select('*')
          .eq('review_id', review.id),
      ])

      return {
        review,
        author: author.data,
        photos: photos.data || [],
      }
    })
  )

  // Fetch related restaurants by cuisine
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

  const hasExternalRatings = restaurant.google_rating || restaurant.yelp_rating || restaurant.beli_score

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Restaurant Header */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 py-8 sm:py-12 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
                {restaurant.name}
              </h1>

              {/* Quick Info */}
              <div className="flex flex-wrap gap-3 text-gray-600">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold">
                  <ChefHat size={15} className="text-emerald-600" />
                  {restaurant.cuisine}
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                  <MapPin size={15} className="text-gray-400" />
                  {restaurant.city}
                </span>
                <span className="inline-flex items-center gap-1 text-lg font-bold text-emerald-700">
                  {priceDisplay}
                </span>
              </div>

              {/* Address */}
              {restaurant.address && (
                <p className="text-gray-600">{restaurant.address}</p>
              )}

              {/* Rating Summary */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <StarRating
                    rating={Math.round(restaurant.avg_rating || 0)}
                    size={24}
                    readonly
                  />
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {(restaurant.avg_rating || 0).toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {restaurant.review_count}{' '}
                      {restaurant.review_count === 1 ? 'review' : 'reviews'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons + External Ratings */}
            <div className="space-y-4 lg:col-span-1">
              {/* External Ratings - At the top */}
              {hasExternalRatings && (
                <div className="flex flex-wrap gap-2">
                  {restaurant.google_rating != null && Number(restaurant.google_rating) > 0 && (
                    <a
                      href={restaurant.google_url || `https://www.google.com/maps/search/${encodeURIComponent(restaurant.name + ' ' + (restaurant.city || ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors group"
                    >
                      <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">G</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-blue-600">Google</p>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-blue-700">{Number(restaurant.google_rating).toFixed(1)}</span>
                          {restaurant.google_review_count != null && restaurant.google_review_count > 0 && (
                            <span className="text-xs text-blue-400">
                              ({restaurant.google_review_count > 999
                                ? (restaurant.google_review_count / 1000).toFixed(1) + 'k'
                                : restaurant.google_review_count})
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-blue-400 group-hover:text-blue-600 shrink-0 ml-1" />
                    </a>
                  )}

                  {restaurant.yelp_rating != null && Number(restaurant.yelp_rating) > 0 && (
                    <a
                      href={restaurant.yelp_url || `https://www.yelp.com/search?find_desc=${encodeURIComponent(restaurant.name)}&find_loc=${encodeURIComponent(restaurant.city || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors group"
                    >
                      <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">Y</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-600">Yelp</p>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-red-700">{Number(restaurant.yelp_rating).toFixed(1)}</span>
                          {restaurant.yelp_review_count != null && restaurant.yelp_review_count > 0 && (
                            <span className="text-xs text-red-400">
                              ({restaurant.yelp_review_count > 999
                                ? (restaurant.yelp_review_count / 1000).toFixed(1) + 'k'
                                : restaurant.yelp_review_count})
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-red-400 group-hover:text-red-600 shrink-0 ml-1" />
                    </a>
                  )}

                  {restaurant.beli_score != null && Number(restaurant.beli_score) > 0 && (
                    <a
                      href={restaurant.beli_url || `https://beliapp.com/search?q=${encodeURIComponent(restaurant.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-colors group"
                    >
                      <div className="w-7 h-7 bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">B</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-purple-600">Beli</p>
                        <span className="text-sm font-bold text-purple-700">{Number(restaurant.beli_score).toFixed(0)}</span>
                      </div>
                      <ExternalLink size={12} className="text-purple-400 group-hover:text-purple-600 shrink-0 ml-1" />
                    </a>
                  )}
                </div>
              )}

              {/* Write a Review - Below external ratings */}
              <Link
                href={`/restaurants/${restaurant.id}/review`}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold text-center block shadow-sm"
              >
                Write a Review
              </Link>

              {restaurant.website && (
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-3 border-2 border-emerald-500 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-colors font-medium text-center flex items-center justify-center gap-2"
                >
                  <Globe size={18} />
                  Visit Website
                </a>
              )}

              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="w-full px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-center flex items-center justify-center gap-2"
                >
                  <Phone size={18} />
                  {restaurant.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reviews Section */}
          <div className="lg:col-span-2 space-y-8">
            {/* Review Stats */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Review Breakdown
                </h2>
                <ReviewStats
                  ratings={ratingBreakdown}
                  totalReviews={reviews.length}
                  averageRating={restaurant.avg_rating || 0}
                />
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {reviews.length > 0 ? 'Recent Reviews' : 'No reviews yet'}
              </h2>

              {reviews.length > 0 ? (
                <div className="space-y-6">
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
                <div className="text-center py-12 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                  <p className="text-lg text-gray-600 mb-4">
                    Be the first to review this restaurant!
                  </p>
                  <Link
                    href={`/restaurants/${restaurant.id}/review`}
                    className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm"
                  >
                    Write a Review
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Restaurant Info Card */}
            <div className="sticky top-20 space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <h3 className="font-bold text-gray-900 text-lg">
                  Restaurant Details
                </h3>

                {restaurant.cuisine && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Cuisine</p>
                    <p className="text-gray-900 font-medium">{restaurant.cuisine}</p>
                  </div>
                )}

                {restaurant.city && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Location</p>
                    <p className="text-gray-900 font-medium">{restaurant.city}</p>
                  </div>
                )}

                {restaurant.address && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Address</p>
                    <p className="text-gray-800 text-sm">{restaurant.address}</p>
                  </div>
                )}

                {restaurant.phone && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Phone</p>
                    <a
                      href={`tel:${restaurant.phone}`}
                      className="text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      {restaurant.phone}
                    </a>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Price Range</p>
                  <p className="text-lg font-bold text-emerald-700">{priceDisplay}</p>
                </div>
              </div>

              {/* Related Restaurants */}
              {relatedRestaurants.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 text-lg">
                    More {restaurant.cuisine}
                  </h3>
                  <div className="space-y-4">
                    {relatedRestaurants.map((related) => (
                      <RestaurantCard
                        key={related.id}
                        restaurant={related}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
