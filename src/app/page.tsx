import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import CriticCard from '@/components/CriticCard'

export const revalidate = 60

async function getHomePageData() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    const reviewsWithData = await Promise.all(
      (reviews || []).map(async (review) => {
        const [restaurantRes, authorRes, photosRes] = await Promise.all([
          supabase.from('restaurants').select('*').eq('id', review.restaurant_id).single(),
          supabase.from('profiles').select('*').eq('id', review.author_id).single(),
          supabase.from('review_photos').select('*').eq('review_id', review.id),
        ])
        return {
          review,
          restaurant: restaurantRes.data,
          author: authorRes.data,
          photos: photosRes.data || [],
        }
      })
    )

    const filteredReviews = reviewsWithData.filter(
      (item): item is typeof reviewsWithData[0] =>
        item.restaurant !== null && item.author !== null
    )

    const { data: topRestaurants } = await supabase
      .from('restaurants')
      .select('*')
      .gt('avg_rating', 0)
      .order('avg_rating', { ascending: false })
      .limit(5)

    const { data: critics } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_critic', true)
      .order('created_at', { ascending: false })
      .limit(4)

    const criticsWithData = await Promise.all(
      (critics || []).map(async (critic) => {
        const { count: reviewCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', critic.id)
        const { count: followerCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', critic.id)
        return {
          profile: critic,
          reviewCount: reviewCount || 0,
          followerCount: followerCount || 0,
        }
      })
    )

    return {
      reviews: filteredReviews,
      topRestaurants: topRestaurants || [],
      critics: criticsWithData,
    }
  } catch {
    return { reviews: [], topRestaurants: [], critics: [] }
  }
}

export default async function Home() {
  const { reviews, topRestaurants, critics } = await getHomePageData()

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">

        {/* Trending Restaurants — horizontal scroll */}
        {topRestaurants.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Trending</h2>
              <Link href="/restaurants" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                See all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {topRestaurants.map((restaurant) => (
                <div key={restaurant.id} className="min-w-[280px] flex-shrink-0">
                  <RestaurantCard restaurant={restaurant} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Critics to follow */}
        {critics.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Critics to follow</h2>
            </div>
            <div className="space-y-2">
              {critics.map(({ profile, reviewCount, followerCount }) => (
                <CriticCard
                  key={profile.id}
                  profile={profile}
                  reviewCount={reviewCount}
                  followerCount={followerCount}
                />
              ))}
            </div>
          </section>
        )}

        {/* Review Feed */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Latest Reviews</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(({ review, restaurant, author, photos }) => (
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
            <div className="text-center py-16 bg-white rounded-lg border border-gray-100">
              <p className="text-gray-500 mb-4">No reviews yet. Be the first!</p>
              <Link
                href="/auth/signup"
                className="inline-block px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
              >
                Write a Review
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
