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

  // Get trending cuisines
  const { data: allRestaurants } = await supabase
    .from('restaurants')
    .select('cuisine')

  const cuisineCounts = (allRestaurants || []).reduce(
    (acc, restaurant) => {
      acc[restaurant.cuisine] = (acc[restaurant.cuisine] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const trendingCuisines = Object.entries(cuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cuisine]) => cuisine)

  return {
    reviews: filteredReviews,
    topRestaurants: topRestaurants || [],
    trendingCuisines,
  }
}

export default async function HomePage() {
  const { reviews, topRestaurants, trendingCuisines } = await getHomePageData()

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900">
      {/* Hero Section */}
      <section className="py-20 px-4 max-w-7xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Gastronome
          </span>
        </h1>
        <p className="text-xl text-neutral-300 mb-2">
          Discover authentic food reviews from passionate home critics
        </p>
        <p className="text-neutral-400 mb-8">
          Rate restaurants, share your dining experiences, and follow fellow food enthusiasts
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/restaurants"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg font-bold transition-colors"
          >
            Explore Restaurants
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-3 border border-amber-500 text-amber-500 hover:bg-amber-500/10 rounded-lg font-bold transition-colors"
          >
            Join Community
          </Link>
        </div>
      </section>

      {/* Latest Reviews Section */}
      <section className="py-16 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="text-amber-500" size={28} />
          <h2 className="text-3xl font-bold text-white">Latest Reviews</h2>
        </div>
        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="text-center py-12 bg-neutral-800/50 rounded-xl border border-neutral-700">
            <p className="text-neutral-300 text-lg mb-4">No reviews yet. Be the first to share your dining experience!</p>
            <Link
              href="/auth/signup"
              className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg font-bold transition-colors"
            >
              Write a Review
            </Link>
          </div>
        )}
      </section>

      {/* Top Rated Restaurants */}
      {topRestaurants.length > 0 && (
        <section className="py-16 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <ChefHat className="text-amber-500" size={28} />
            <h2 className="text-3xl font-bold text-white">Top Rated Restaurants</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Cuisines */}
      {trendingCuisines.length > 0 && (
        <section className="py-16 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Users className="text-amber-500" size={28} />
            <h2 className="text-3xl font-bold text-white">Trending Cuisines</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {trendingCuisines.map((cuisine) => (
              <CuisineTag key={cuisine} cuisine={cuisine} />
            ))}
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-20 px-4 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4 text-white">Ready to Share Your Thoughts?</h2>
        <p className="text-neutral-400 mb-8">
          Join our community of passionate food critics and share your restaurant reviews
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg font-bold transition-colors"
        >
          Get Started
        </Link>
      </section>
    </div>
  )
}
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

  // Get trending cuisines
  const { data: allRestaurants } = await supabase
    .from('restaurants')
    .select('cuisine')

  const cuisineCounts = (allRestaurants || []).reduce(
    (acc, restaurant) => {
      acc[restaurant.cuisine] = (acc[restaurant.cuisine] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const trendingCuisines = Object.entries(cuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cuisine]) => cuisine)

  return {
    reviews: filteredReviews,
    topRestaurants: topRestaurants || [],
    trendingCuisines,
  }
}

export default async function HomePage() {
  const { reviews, topRestaurants, trendingCuisines } = await getHomePageData()

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900">
      {/* Hero Section */}
      <section className="py-20 px-4 max-w-7xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Gastronome
          </span>
        </h1>
        <p className="text-xl text-neutral-300 mb-2">
          Discover authentic food reviews from passionate home critics
        </p>
        <p className="text-neutral-400 mb-8">
          Rate restaurants, share your dining experiences, and follow fellow food enthusiasts
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/discover"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg font-bold transition-colors"
          >
            Explore Restaurants
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-3 border border-amber-500 text-amber-500 hover:bg-amber-500/10 rounded-lg font-bold transition-colors"
          >
            Join Community
          </Link>
        </div>
      </section>

      {/* Latest Reviews Section */}
      {reviews.length > 0 && (
        <section className="py-16 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="text-amber-500" size={28} />
            <h2 className="text-3xl font-bold text-white">Latest Reviews</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </section>
      )}

      {/* Top Rated Restaurants */}
      {topRestaurants.length > 0 && (
        <section className="py-16 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <ChefHat className="text-amber-500" size={28} />
            <h2 className="text-3xl font-bold text-white">Top Rated Restaurants</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Cuisines */}
      {trendingCuisines.length > 0 && (
        <section className="py-16 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Users className="text-amber-500" size={28} />
            <h2 className="text-3xl font-bold text-white">Trending Cuisines</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {trendingCuisines.map((cuisine) => (
              <CuisineTag key={cuisine} cuisine={cuisine} />
            ))}
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-20 px-4 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4 text-white">Ready to Share Your Thoughts?</h2>
        <p className="text-neutral-400 mb-8">
          Join our community of passionate food critics and share your restaurant reviews
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg font-bold transition-colors"
        >
          Get Started
        </Link>
      </section>
    </div>
  )
}
