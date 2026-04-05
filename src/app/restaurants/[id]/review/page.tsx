'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import StarRating from '@/components/StarRating';

export default function WriteReviewPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visitDate, setVisitDate] = useState('');

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

    // Fetch restaurant
    const fetchRestaurant = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (data) {
        setRestaurant(data);
      }
    };

    fetchRestaurant();
  }, [restaurantId, supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to write a review');
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
          visit_date: visitDate || null,
        },
      ]);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
      } else {
        router.push(`/restaurants/${restaurantId}`);
      }
    } catch (err) {
      setError('Failed to submit review');
      setLoading(false);
    }
  };

  if (!user || !restaurant) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/restaurants/${restaurantId}`} className="text-amber-500 hover:text-amber-400 text-sm mb-4 inline-block">
            ← Back to Restaurant
          </Link>
          <h1 className="text-4xl font-bold mb-2">Review {restaurant.name}</h1>
          <p className="text-neutral-400">Share your culinary experience</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Your Rating
            </label>
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onChange={(value) => setRating(value)}
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-neutral-300 mb-2">
              Review Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Exceptional pasta and atmosphere"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-neutral-300 mb-2">
              Your Review
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your honest feedback about the food, service, and atmosphere..."
              rows={6}
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white rounded-lg focus:outline-none focus:border-amber-500 transition-colors resize-none"
              required
            />
          </div>

          {/* Visit Date */}
          <div>
            <label htmlFor="visitDate" className="block text-sm font-medium text-neutral-300 mb-2">
              Visit Date (Optional)
            </label>
            <input
              id="visitDate"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white rounded-lg focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !title.trim() || !content.trim()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-neutral-950 rounded-lg font-bold transition-colors"
          >
            {loading ? 'Publishing Review...' : 'Publish Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
