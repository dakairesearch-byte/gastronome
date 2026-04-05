import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ReviewCard from '@/components/ReviewCard'
import RestaurantCard from '@/components/RestaurantCard'
import CriticCard from '@/components/CriticCard'
import CuisineTag from '@/components/CuisineTag'
import { TrendingUp, Users, ChefHat } from 'lucide-react'

export const revalidate = 60

async function getHomePageData() {
  const supabase = await createServerSupabaseClient()

  // Get latest reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(6)

  const reviewsWithData = await Promise.all(
    (reviews || []).map(async (review) => {
      const [restaurantRes, authorRes, photosRes] = await Promise.all([
        supabase
          .from('restaurants')
          .select('*')
          .eq('id', review.restaurant_id)
          .single(),
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

  // Get top-rated restaurants (trending)
  const { data: topRestaurants } = await supabase
    .from('restaurants')
    .select('*')
    .gt('avg_rating', 0)
    .order('avg_rating', { ascending: false })
    .limit(6)

  // Get featured critics
  const { data: critics } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_critic', true)
    .order('created_at', { ascending: false })
    .limit(6)

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

  // Get unique cuisines
  const { data: allRestaurants } = await supabase
    .from('restaurants')
    .select('cuisine')

  const cuisines = [
    ...new Set((allRestaurants || []).map((r) => r.cuisine)),
  ]
    .sort()
    .slice(0, 8)

  return {
    reviews: filteredReviews,
    topRestaurants: topRestaurants || [],
    critics: criticsWithData,
    cuisines,
  }
}

export default async function Home() {
  const { reviews, topRestaurants, critics, cuisines } = await getHomePageData()

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-amber-50 via-white to-orange-50 py-16 sm:py-32 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Discover Authentic <span className="text-amber-600">Food Reviews</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Connect with passionate food critics. Share your dining experiences. Rate restaurants you love.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/restaurants"
                className="px-8 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold text-lg"
              >
                Explore Restaurants
              </Link>
              <Link
                href="/search"
                className="px-8 py-3 border-2 border-amber-500 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors font-semibold text-lg"
              >
                Search Reviews
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cuisine Discovery */}
      {cuisines.length > 0 && (
        <section className="py-12 sm:py-16 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <ChefHat size={28} className="text-amber-600" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Explore by Cuisine
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {cuisines.map((cuisine) => (
                <CuisineTag key={cuisine} cuisine={cuisine} variant="default" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Restaurants */}
      {topRestaurants.length > 0 && (
        <section className="py-12 sm:py-16 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp size={28} className="text-amber-600" />
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Top Rated
                </h2>
                <p className="text-gray-600">Most loved restaurants by critics</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topRestaurants.slice(0, 6).map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/restaurants"
                className="text-amber-600 hover:text-amber-700 font-semibold transition-colors"
              >
                View all restaurants â
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Latest Reviews */}
      <section className="py-12 sm:py-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Latest Reviews
            </h2>
            <p className="text-lg text-gray-600">
              Discover what critics are saying right now
            </p>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reviews.slice(0, 6).map(({ review, restaurant, author, photos }) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    restaurant={restaurant}
                    author={author}
                    photos={photos}
                  />
                ))}
              </div>
              {reviews.length > 6 && (
                <div className="text-center pt-4">
                  <Link
                    href="/search"
                    className="text-amber-600 hover:text-amber-700 font-semibold transition-colors"
                  >
                    View all reviews â
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-100">
              <p className="text-lg text-gray-600 mb-6">
                Be the first to share a dining experience!
              </p>
              <Link
                href="/auth/signup"
                className="inline-block px-8 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold"
              >
                Write a Review
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Featured Critics */}
      {critics.length > 0 && (
        <section className="py-12 sm:py-16 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <Users size={28} className="text-amber-600" />
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Featured Critics
                </h2>
                <p className="text-gray-600">Follow passionate food reviewers</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {critics.map(({ profile, reviewCount, followerCount }) => (
                <CriticCard
                  key={profile.id}
                  profile={profile}
                  reviewCount={reviewCount}
                  followerCount={followerCount}
                  isFeatured={true}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-amber-50 to-orange-50 border-t border-amber-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Ready to share your dining story?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join our community of passionate food critics and discover amazing restaurants through authentic reviews.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block px-8 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold text-lg"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  )
}
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import RestaurantCard from '@/components/RestaurantCard';
import ReviewCard from '@/components/ReviewCard';

export default async function Home() {
  const supabase = await createClient();

  let trendingRestaurants: any[] = [];
  let recentReviews: any[] = [];

  // Fetch trending restaurants
  try {
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (!error && restaurants) {
      trendingRestaurants = restaurants;
    }
  } catch (err) {
    console.error('Error fetching restaurants:', err);
  }

  // Fetch recent reviews with author
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*, profiles:author_id(id, username, display_name, avatar_url, is_critic)')
      .order('created_at', { ascending: false })
      .limit(4);

    if (!error && reviews) {
      recentReviews = reviews;
    }
  } catch (err) {
    console.error('Error fetching reviews:', err);
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-600/10 via-neutral-950 to-neutral-950 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              Discover
            </span>
            {' '}Your Next
            <br />
            <span className="text-white">Favorite Restaurant</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-8">
            Explore authentic reviews from passionate food lovers and critics. Find your next culinary adventure.
          </p>
          <Link
            href="/discover"
            className="inline-block px-8 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-full font-bold transition-colors"
          >
            Start Exploring
          </Link>
        </div>
      </section>

      {/* Trending Now Section */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Trending Now</h2>
          <Link href="/discover" className="text-amber-500 hover:text-amber-400 text-sm font-medium">
            View All →
          </Link>
        </div>
        {trendingRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <p>No restaurants available yet</p>
          </div>
        )}
      </section>

      {/* Recent Reviews Section */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Recent Reviews</h2>
        {recentReviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review as any}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <p>No reviews yet</p>
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Discover',
              description: 'Browse restaurants curated by passionate food lovers.',
              icon: '🔍',
            },
            {
              step: '2',
              title: 'Review',
              description: 'Share your honest feedback and culinary experiences.',
              icon: '✍️',
            },
            {
              step: '3',
              title: 'Share',
              description: 'Connect with other food enthusiasts in the community.',
              icon: '🤝',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl bg-neutral-900/50 border border-neutral-800/50 p-6 text-center hover:border-amber-500/30 transition-colors"
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-neutral-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
