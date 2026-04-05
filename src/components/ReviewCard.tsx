import { ReviewWithAuthor } from '@/lib/types';
import StarRating from './StarRating';

interface ReviewCardProps {
  review: ReviewWithAuthor;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const visitDate = review.visit_date
    ? new Date(review.visit_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="rounded-xl bg-neutral-900/50 border border-neutral-800/50 p-4 hover:border-neutral-700/50 transition-colors">
      {/* Author Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-neutral-950">
            {review.profiles?.avatar_url ? (
              <img
                src={review.profiles.avatar_url}
                alt={review.profiles.username || 'User'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(review.profiles?.username || 'Unknown')
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{review.profiles?.username ?? 'Unknown'}</p>
              {review.profiles?.is_critic && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 rounded-full">
                  CRITIC
                </span>
              )}
            </div>
            {visitDate && <p className="text-xs text-neutral-500">{visitDate}</p>}
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="mb-3">
        <StarRating rating={review.rating} size="sm" />
      </div>

      {/* Review Title & Content */}
      <h4 className="text-sm font-bold text-white mb-2">{review.title}</h4>
      <p className="text-sm text-neutral-400 line-clamp-3">{review.content}</p>
    </div>
  );
}
