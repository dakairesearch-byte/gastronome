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
