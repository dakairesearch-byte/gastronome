import { createServerSupabaseClient } from '@/lib/supabase/server';
import RestaurantCard from '@/components/RestaurantCard';
import { Restaurant } from '@/lib/types';
import { TrendingUp } from 'lucide-react';

export default async function TopRatedPage() {
  const supabase = await createServerSupabaseClient();

  let restaurants: Restaurant[] = [];

  // Fetch all restaurants with ratings
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .gt('review_count', 0)
      .order('avg_rating', { ascending: false });

    if (!error && data) {
      restaurants = data;
    }
  } catch (err) {
    console.error('Error fetching restaurants:', err);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 py-8 sm:py-12 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={28} className="text-amber-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Top Rated</h1>
          </div>
          <p className="text-lg text-gray-600">
            The best restaurants loved by our community
          </p>
        </div>
      </div>

      {/* Restaurants Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
          <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
            <div className="bg-amber-50 p-4 rounded-full mb-6 inline-block">
              <TrendingUp size={32} className="text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Rated Restaurants Yet</h2>
            <p className="text-gray-600">
              Be the first to leave a review and help other food lovers discover great places!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
