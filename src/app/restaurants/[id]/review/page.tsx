'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import StarRating from '@/components/StarRating';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function WriteReviewPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUser(user);
    };

    checkUser();

    const fetchRestaurant = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (data) {
        setRestaurant(data);
      }
      setPageLoading(false);
    };

    fetchRestaurant();
  }, [restaurantId, supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to write a review');
      return;
    }

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('reviews').insert([
        {
          restaurant_id: restaurantId,
          author_id: user.id,
          rating,
          title,
          content,
        },
      ]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      // Update restaurant stats
      if (restaurant) {
        const currentAvgRating = restaurant.avg_rating || 0;
        const newAvgRating =
          (currentAvgRating * restaurant.review_count + rating) /
          (restaurant.review_count + 1);

        await supabase
          .from('restaurants')
          .update({
            avg_rating: newAvgRating,
            review_count: restaurant.review_count + 1,
          })
          .eq('id', restaurantId);
      }

      router.push(`/restaurants/${restaurantId}`);
      router.refresh();
    } catch (err) {
      setError('Failed to submit review');
      setLoading(false);
    }
  };

  if (pageLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Restaurant not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/restaurants/${restaurantId}`} className="text-amber-600 hover:text-amber-700 text-sm mb-4 inline-block font-medium">
            &larr; Back to {restaurant.name}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Review {restaurant.name}
          </h1>
          <p className="text-lg text-gray-600">Share your culinary experience</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Restaurant Info */}
        <div className="mb-6 p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
          <p className="text-sm text-gray-600 mb-2">Reviewing</p>
          <h2 className="text-2xl font-bold text-gray-900">{restaurant.name}</h2>
          <p className="text-gray-600 mt-1">
            {restaurant.cuisine} &bull; {restaurant.city}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-900">
              Your Rating
            </label>
            <div className="p-6 bg-amber-50 rounded-xl border border-amber-200">
              <StarRating
                rating={rating}
                size={40}
                readonly={false}
                onRate={(value) => setRating(value)}
              />
              {rating > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  You rated this restaurant <span className="font-bold text-amber-700">{rating} stars</span>
                </p>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Review Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Exceptional pasta and atmosphere"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Your Review *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your honest feedback about the food, service, and atmosphere..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition resize-none"
              required
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim() || rating === 0}
              className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Publishing Review...' : 'Publish Review'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
