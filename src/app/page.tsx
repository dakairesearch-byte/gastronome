import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import { Star, ArrowRight, TrendingUp, Users, PenSquare } from 'lucide-react'

export const revalidate = 60

async function getHomePageData() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)

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
      .limit(8)

    const { data: critics } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_critic', true)
      .order('created_at', { ascending: false })
      .limit(8)

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

    const { count: totalReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })

    const { count: totalRestaurants } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true })

    return {
      reviews: filteredReviews,
      topRestaurants: topRestaurants || [],
      critics: criticsWithData,
      totalReviews: totalReviews || 0,
      totalRestaurants: totalRestaurants || 0,
    }
  } catch {
    return { reviews: [], topRestaurants: [], critics: [], totalReviews: 0, totalRestaurants: 0 }
  }
}

export default async function Home() {
  const { reviews, topRestaurants, critics, totalReviews, totalRestaurants } = await getHomePageData()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Discover your next
              <br />
              favorite restaurant
            </h1>
            <p className="mt-4 text-lg text-emerald-100 max-w-lg">
              Real reviews from food critics and enthusiasts. Find, review, and share the best dining experiences.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/restaurants"
                className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold text-sm hover:bg-emerald-50 transition-colors shadow-lg shadow-emerald-900/20"
              >
                Explore restaurants
              </Link>
              <Link
                href="/auth/signup"
                className="px-6 py-3 bg-emerald-700/40 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700/60 transition-colors backdrop-blur-sm border border-white/20"
              >
                Join as a critic
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 flex gap-8 sm:gap-12">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">{totalRestaurants}</p>
              <p className="text-sm text-emerald-200">Restaurants</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">{totalReviews}</p>
              <p className="text-sm text-emerald-200">Reviews</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">{critics.length}+</p>
              <p className="text-sm text-emerald-200">Critics</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Restaurants — horizontal scroll */}
      {topRestaurants.length > 0 && (
        <section className="py-10 sm:py-14">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">Trending restaurants</h2>
              </div>
              <Link
                href="/restaurants"
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
              {topRestaurants.map((restaurant) => (
                <div key={restaurant.id} className="min-w-[280px] sm:min-w-[300px] flex-shrink-0 snap-start">
                  <RestaurantCard restaurant={restaurant} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Critics to Follow — horizontal scroll with circular avatars */}
      {critics.length > 0 && (
        <section className="py-10 sm:py-14 bg-gray-50 border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-900">Food critics to follow</h2>
              </div>
            </div>
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
              {critics.map(({ profile, reviewCount, followerCount }) => (
                <Link
                  key={profile.id}
                  href={`/profile/${profile.id}`}
                  className="flex flex-col items-center gap-2 min-w-[100px] flex-shrink-0 snap-start group"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-0.5 group-hover:from-emerald-500 group-hover:to-teal-600 transition-all shadow-md">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        className="w-full h-full rounded-full object-cover bg-white"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <span className="text-lg sm:text-xl font-bold text-emerald-600">
                          {profile.display_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 truncate max-w-[100px] group-hover:text-emerald-700 transition-colors">
                      {profile.display_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Reviews */}
      <section className="py-10 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Star size={20} className="text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">Latest reviews</h2>
            </div>
            <Link
              href="/feed"
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <PenSquare size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">No reviews yet. Be the first!</p>
              <Link
                href="/auth/signup"
                className="inline-block px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
              >
                Write a Review
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Dark CTA Section */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Share your dining experiences
            </h2>
            <p className="mt-4 text-gray-400 text-lg">
              Join our community of food critics. Write reviews, follow your favorite critics, and discover hidden gems.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/signup"
                className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 transition-colors"
              >
                Get started free
              </Link>
              <Link
                href="/restaurants"
                className="px-8 py-3 bg-gray-800 text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-700 transition-colors border border-gray-700"
              >
                Browse restaurants
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
