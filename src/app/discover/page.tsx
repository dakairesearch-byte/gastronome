import { createServerSupabaseClient } from '@/lib/supabase/server';
import RestaurantCard from '@/components/RestaurantCard';
import { Restaurant } from '@/lib/types';
import { MapPin } from 'lucide-react';

export default async function DiscoverPage() {
  const supabase = await createServerSupabaseClient();

  let restaurants: Restaurant[] = [];

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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 py-8 sm:py-12 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Discover Restaurants</h1>
          <p className="text-lg text-gray-600">
            Explore amazing restaurants and read authentic reviews from our community.
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
          <div className="text-center py-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
            <div className="bg-emerald-50 p-4 rounded-full mb-6 inline-block">
              <MapPin size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Restaurants Yet</h2>
            <p className="text-gray-600">
              Be the first to add a restaurant to our community!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
