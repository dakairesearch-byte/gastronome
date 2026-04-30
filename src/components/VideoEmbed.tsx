import { X, Heart, Eye, MessageCircle, ExternalLink } from 'lucide-react'
import { formatCount } from '@/lib/format'
import type { RestaurantVideo } from '@/types/database'

interface VideoEmbedProps {
  video: RestaurantVideo
  onClose?: () => void
}

export default function VideoEmbed({ video, onClose }: VideoEmbedProps) {
  const embedUrl =
    video.platform === 'tiktok'
      ? `https://www.tiktok.com/embed/v2/${video.video_id}`
      : `https://www.instagram.com/reel/${video.video_id}/embed/`

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-[360px] sm:max-w-[400px] w-full mx-auto">
      {/* Header with close button */}
      {onClose && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600 uppercase">
              {video.platform}
            </span>
            {video.author_display_name && (
              <span className="text-sm font-medium text-gray-900">{video.author_display_name}</span>
            )}
            {video.author_username && (
              <span className="text-sm text-gray-500">@{video.author_username}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Embed iframe */}
      <div className="relative w-full" style={{ paddingBottom: video.platform === 'tiktok' ? '177%' : '120%' }}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={video.caption || `${video.platform} video`}
        />
      </div>

      {/* Info section */}
      <div className="px-4 py-3 space-y-2">
        {/* Author info (shown when no close button header) */}
        {!onClose && (video.author_display_name || video.author_username) && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600 uppercase">
              {video.platform}
            </span>
            {video.author_display_name && (
              <span className="text-sm font-medium text-gray-900">{video.author_display_name}</span>
            )}
            {video.author_username && (
              <span className="text-sm text-gray-500">@{video.author_username}</span>
            )}
          </div>
        )}

        {/* Caption */}
        {video.caption && (
          <p className="text-sm text-gray-700 line-clamp-3">{video.caption}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {video.like_count > 0 && (
            <span className="flex items-center gap-1">
              <Heart size={14} className="text-red-400" />
              {formatCount(video.like_count)}
            </span>
          )}
          {video.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={14} className="text-gray-400" />
              {formatCount(video.view_count)}
            </span>
          )}
          {video.comment_count > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircle size={14} className="text-gray-400" />
              {formatCount(video.comment_count)}
            </span>
          )}
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Watch on {video.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}
