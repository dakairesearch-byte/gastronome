import Link from 'next/link'
import { Play, Heart, Eye } from 'lucide-react'

interface VideoCardProps {
  videoUrl: string
  platform: 'tiktok' | 'instagram'
  authorUsername: string | null
  likeCount: number | null
  viewCount: number | null
  restaurantName: string
  restaurantId: string
}

/**
 * Community video card with platform gradient fallback (thumbnails are null).
 * Direct link to video_url opens in new tab.
 */
export default function VideoCard({
  videoUrl,
  platform,
  authorUsername,
  likeCount,
  viewCount,
  restaurantName,
  restaurantId,
}: VideoCardProps) {
  const gradient =
    platform === 'tiktok'
      ? 'from-gray-900 via-gray-800 to-pink-900'
      : 'from-purple-900 via-pink-800 to-orange-700'

  return (
    <div className="rounded-sm overflow-hidden shadow-md transition-all hover:shadow-2xl group" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* Gradient thumbnail */}
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block relative aspect-[9/14] bg-gradient-to-br ${gradient}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Play size={24} className="text-white fill-white ml-1" />
          </div>
        </div>
        {/* Platform badge */}
        <div className="absolute top-3 left-3">
          <span
            className="px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider font-medium text-white backdrop-blur-sm"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.08em',
              backgroundColor: platform === 'tiktok' ? 'rgba(0,0,0,0.6)' : 'rgba(131,58,180,0.6)',
            }}
          >
            {platform === 'tiktok' ? 'TikTok' : 'Instagram'}
          </span>
        </div>
        {/* Author + stats */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          {authorUsername && (
            <p className="text-white text-xs font-medium mb-1 truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              @{authorUsername}
            </p>
          )}
          <div className="flex items-center gap-3 text-white/80 text-[10px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {likeCount != null && likeCount > 0 && (
              <span className="flex items-center gap-1">
                <Heart size={10} />
                {formatCount(likeCount)}
              </span>
            )}
            {viewCount != null && viewCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={10} />
                {formatCount(viewCount)}
              </span>
            )}
          </div>
        </div>
      </a>
      {/* Restaurant link */}
      <div className="p-3">
        <Link
          href={`/restaurants/${restaurantId}`}
          className="text-sm font-medium hover:underline line-clamp-1 transition-colors"
          style={{ color: 'var(--color-text)', fontFamily: "'DM Sans', sans-serif" }}
        >
          {restaurantName}
        </Link>
      </div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
