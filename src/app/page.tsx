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
