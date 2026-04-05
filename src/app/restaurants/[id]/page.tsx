import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import ReviewStats from '@/components/ReviewStats'
import StarRating from '@/components/StarRating'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Globe, ChefHat } from 'lucide-react'

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
  params: { id: string }
}) {
  const data = await getRestaurantData(params.id)

  if (!data) {
    notFound()
  }

  const { restaurant, reviews, relatedRestaurants } = data
  const priceDisplay = '$'.repeat(restaurant.price_range)
  const ratingBreakdown = reviews.map((r) => r.review.rating)

  return (
    <div className="min-h-screen bg-white">
      {/* Restaurant Header */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 py-8 sm:py-12 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
                {restaurant.name}
              </h1>

              {/* Quick Info */}
              <div className="flex flex-wrap gap-3 text-gray-600">
                <span className="inline-flex items-center gap-1 text-sm">
                  <ChefHat size={16} className="text-amber-600" />
                  {restaurant.cuisine}
                </span>
                <span className="inline-flex items-center gap-1 text-sm">
                  <MapPin size={16} className="text-amber-600" />
                  {restaurant.city}
                </span>
                <span className="inline-flex items-center gap-1 text-lg font-bold text-amber-700">
                  {priceDisplay}
                </span>
              </div>

              {/* Address */}
              {restaurant.address && (
                <p className="text-gray-700">{restaurant.address}</p>
              )}

              {/* Rating Summary */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <StarRating
                    rating={Math.round(restaurant.avg_rating || 0)}
                    size={24}
                    readonly
                  />
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {(restaurant.avg_rating || 0).toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {restaurant.review_count} {restaurant.review_count === 1 ? 'review' : 'reviews'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 lg:col-span-1">
              <Link
                href="/review/new"
                className="w-full py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold text-center block"
              >
                Write a Review
              </Link>

              {restaurant.website && (
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-center block flex items-center justify-center gap-2"
                >
                  <Globe size={18} />
                  Visit Website
                </a>
              )}

              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-center block flex items-center justify-center gap-2"
                >
                  <Phone size={18} />
                  Call
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reviews List */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-6">Reviews ({reviews.length})</h2>
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
                <div className="text-center py-8">
                  <p className="text-gray-500">No reviews yet. Be the first to review!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {reviews.length > 0 && (
              <ReviewStats
                ratings={ratingBreakdown}
                totalReviews={reviews.length}
              />
            )}
          </div>
        </div>
      </div>

      {/* Related Restaurants */}
      {relatedRestaurants.length > 0 && (
        <section className="py-12 px-4 max-w-7xl mx-auto border-t border-gray-200">
          <h2 className="text-2xl font-bold mb-6">Similar Restaurants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedRestaurants.map((restaur) => (
              <RestaurantCard key={restaur.id} restaurant={restaur} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
