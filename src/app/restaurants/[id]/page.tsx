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
                  className="w-full px-4 py-3 border-2 border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors font-medium text-center flex items-center justify-center gap-2"
                >
                  <Globe size={18} />
                  Visit Website
                </a>
              )}

              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center flex items-center justify-center gap-2"
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
              <div className="bg-white rounded-lg border border-amber-100 p-6">
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
                <div className="text-center py-12 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-100">
                  <p className="text-lg text-gray-600 mb-4">
                    Be the first to review this restaurant!
                  </p>
                  <Link
                    href="/review/new"
                    className="inline-block px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold"
                  >
                    Write a Review
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Restaurant Info Card */}
            <div className="sticky top-20 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 text-lg">
                Restaurant Details
              </h3>

              {restaurant.cuisine && (
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Cuisine</p>
                  <p className="text-gray-900">{restaurant.cuisine}</p>
                </div>
              )}

              {restaurant.city && (
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Location</p>
                  <p className="text-gray-900">{restaurant.city}</p>
                </div>
              )}

              {restaurant.address && (
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Address</p>
                  <p className="text-gray-900 text-sm">{restaurant.address}</p>
                </div>
              )}

              {restaurant.phone && (
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Phone</p>
                  <a
                    href={`tel:${restaurant.phone}`}
                    className="text-amber-600 hover:text-amber-700 font-medium"
                  >
                    {restaurant.phone}
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Price Range</p>
                <p className="text-lg font-bold text-amber-700">{priceDisplay}</p>
              </div>
            </div>

            {/* Related Restaurants */}
            {relatedRestaurants.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">
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
  )
}
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ReviewCard from '@/components/ReviewCard';
import StarRating from '@/components/StarRating';

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch restaurant
  let restaurant = null;
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      notFound();
    }
    restaurant = data;
  } catch (err) {
    notFound();
  }

  // Fetch reviews with authors
  let reviews: any[] = [];
  let averageRating = 0;
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:author_id(id, username, display_name, avatar_url, is_critic)')
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      reviews = data;
      if (reviews.length > 0) {
        const sum = (reviews as any[]).reduce((acc, review) => acc + review.rating, 0);
        averageRating = sum / reviews.length;
      }
    }
  } catch (err) {
    console.error('Error fetching reviews:', err);
  }

  const priceDisplay = ''.padEnd(restaurant.price_range || 1, '$');

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Image */}
      <div className="relative w-full h-64 md:h-96 bg-gradient-to-br from-amber-600/20 via-neutral-900 to-neutral-950 overflow-hidden">
        {restaurant.image_url ? (
          <img
            src={restaurant.image_url}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-7xl">🍽️</div>
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{restaurant.name}</h1>
              <div className="flex flex-wrap gap-3">
                {restaurant.cuisine_type && (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm font-medium">
                    {restaurant.cuisine_type}
                  </span>
                )}
                {restaurant.price_range && (
                  <span className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full text-sm font-medium">
                    {priceDisplay}
                  </span>
                )}
              </div>
            </div>

            {/* Rating */}
            <div className="flex flex-col items-start md:items-end gap-2">
              <StarRating rating={Math.round(averageRating * 2) / 2} size="lg" />
              <p className="text-neutral-400 text-sm">
                {averageRating > 0
                  ? `${averageRating.toFixed(1)} (${reviews.length} reviews)`
                  : 'No reviews yet'}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="text-neutral-400 mb-4">
            <p className="flex items-center gap-2">
              <span>📍</span>
              {restaurant.address && <span>{restaurant.address}</span>}
              {restaurant.city && <span>{restaurant.city}</span>}
              {restaurant.state && <span>{restaurant.state}</span>}
            </p>
          </div>

          {/* Write Review CTA */}
          <Link
            href={`/restaurants/${id}/review`}
            className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-full font-bold transition-colors"
          >
            Write a Review
          </Link>
        </div>

        {/* Reviews Section */}
        <div className="border-t border-neutral-800 pt-8">
          <h2 className="text-3xl font-bold mb-6">Reviews</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {(reviews as any[]).map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-neutral-500">
              <p className="text-lg">No reviews yet. Be the first to share your experience!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
