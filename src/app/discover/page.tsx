import { createServerSupabaseClient } from '@/lib/supabase/server';
import RestaurantCard from '@/components/RestaurantCard';
import { Restaurant, Review } from '@/lib/types';

export default async function DiscoverPage() {
  const supabase = await createServerSupabaseClient();

  let restaurants: Restaurant[] = [];
  const restaurantRatings: Record<string, { avg: number; count: number }> = {};

  // Fetch all restaurants
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      restaurants = data;
    }
  } catch (err) {
    console.error('Error fetching restaurants:', err);
  }

  // Fetch reviews to calculate ratings
  if (restaurants.length > 0) {
    try {
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('restaurant_id, rating');

      if (!error && reviews) {
        (reviews as any[]).forEach((review) => {
          if (!restaurantRatings[review.restaurant_id]) {
            restaurantRatings[review.restaurant_id] = { avg: 0, count: 0 };
          }
          restaurantRatings[review.restaurant_id].avg += review.rating;
          restaurantRatings[review.restaurant_id].count += 1;
        });

        // Calculate averages
        Object.keys(restaurantRatings).forEach((key) => {
          restaurantRatings[key].avg = restaurantRatings[key].avg / restaurantRatings[key].count;
        });
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <section className="py-12 px-4 max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">Discover Restaurants</h1>
        <p className="text-neutral-400 text-lg">
          Explore amazing restaurants and read authentic reviews from our community.
        </p>
      </section>

      {/* Restaurants Grid */}
      <section className="py-8 px-4 max-w-7xl mx-auto">
        {restaurants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🍽️</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Restaurants Yet</h2>
            <p className="text-neutral-400">
              Be the first to add a restaurant to our community!
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
