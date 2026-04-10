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

    if (!title.trim()) {
      setError('Please enter a review title');
      return;
    }

    if (content.trim().length < 20) {
      setError('Review must be at least 20 characters');
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
        <Loader2 className="animate-spin text-emerald-500" size={32} />
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
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/restaurants/${restaurantId}`} className="text-emerald-600 hover:text-emerald-700 text-sm mb-3 inline-block font-medium">
            &larr; Back to {restaurant.name}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            Review {restaurant.name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Share your experience</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Restaurant Info */}
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">Reviewing</p>
          <h2 className="text-base font-bold text-gray-900">{restaurant.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {restaurant.cuisine} &bull; {restaurant.city}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Rating */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Rating
            </label>
            <div className="p-4 bg-white rounded-lg border border-gray-100">
              <StarRating
                rating={rating}
                size={32}
                readonly={false}
                onRate={(value) => setRating(value)}
              />
              {rating > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  You rated this restaurant <span className="font-bold text-emerald-600">{rating} stars</span>
                </p>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Review Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Exceptional pasta and atmosphere"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Your Review *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your honest feedback about the food, service, and atmosphere..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none text-sm"
              required
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim() || rating === 0}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Publishing...' : 'Publish Review'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
