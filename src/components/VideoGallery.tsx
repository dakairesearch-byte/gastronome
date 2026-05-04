'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heart, Eye, Play, SlidersHorizontal, Music2, Camera } from 'lucide-react'
import { formatCount } from '@/lib/format'
import type { RestaurantVideo } from '@/types/database'
import VideoEmbed from './VideoEmbed'

function VideoThumbnail({ video }: { video: RestaurantVideo }) {
  const [failed, setFailed] = useState(false)
  const showFallback = !video.thumbnail_url || failed

  if (showFallback) {
    const isTikTok = video.platform === 'tiktok'
    const gradient = isTikTok
      ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-black'
      : 'bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500'
    const Icon = isTikTok ? Music2 : Camera
    return (
      <div className={`absolute inset-0 ${gradient} flex flex-col justify-between p-3 text-white`}>
        <div className="flex items-center justify-between">
          <Icon size={20} className="drop-shadow" />
          <span className="px-1.5 py-0.5 bg-white/15 backdrop-blur-sm rounded text-[10px] font-bold uppercase tracking-wide">
            {video.platform}
          </span>
        </div>
        <div className="space-y-1">
          {video.author_username && (
            <p className="text-xs font-semibold opacity-90 truncate">
              @{video.author_username}
            </p>
          )}
          {video.caption && (
            <p className="text-[11px] opacity-80 line-clamp-2 leading-snug">
              {video.caption}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <img
      src={video.thumbnail_url!}
      alt={video.caption || 'Video thumbnail'}
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    />
  )
}

type Platform = 'all' | 'tiktok' | 'instagram'
type SortOption = 'most_liked' | 'most_viewed' | 'newest'

interface VideoGalleryProps {
  restaurantId: string
}

export default function VideoGallery({ restaurantId }: VideoGalleryProps) {
  const [videos, setVideos] = useState<RestaurantVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<Platform>('all')
  const [sortBy, setSortBy] = useState<SortOption>('most_liked')
  const [selectedVideo, setSelectedVideo] = useState<RestaurantVideo | null>(null)

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    async function fetchVideos() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/restaurants/videos?restaurantId=${encodeURIComponent(restaurantId)}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error('Failed to fetch videos')
        const data = await res.json()
        if (!alive) return
        setVideos(data)
      } catch (err) {
        if (!alive) return
        if ((err as Error)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load videos')
      } finally {
        if (alive) setLoading(false)
      }
    }
    fetchVideos()
    return () => {
      alive = false
      controller.abort()
    }
  }, [restaurantId])

  const handleCloseModal = useCallback(() => {
    setSelectedVideo(null)
  }, [])

  // Handle escape key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedVideo(null)
    }
    if (selectedVideo) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedVideo])

  // Filter and sort
  const filteredVideos = videos
    .filter((v) => platform === 'all' || v.platform === platform)
    .sort((a, b) => {
      switch (sortBy) {
        case 'most_liked':
          return b.like_count - a.like_count
        case 'most_viewed':
          return b.view_count - a.view_count
        case 'newest':
          return new Date(b.posted_at ?? b.created_at).getTime() - new Date(a.posted_at ?? a.created_at).getTime()
        default:
          return 0
      }
    })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] md:aspect-[3/4] lg:aspect-[4/5] max-h-[400px] bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{error}</p>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
          <Play className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">
          No social videos yet
        </h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          We&apos;re tracking TikTok and Instagram for this restaurant. Videos will appear here as they&apos;re discovered.
        </p>
      </div>
    )
  }

  const tabs: { value: Platform; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'instagram', label: 'Instagram' },
  ]

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'most_liked', label: 'Most Liked' },
    { value: 'most_viewed', label: 'Most Viewed' },
    { value: 'newest', label: 'Newest' },
  ]

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Platform tabs */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setPlatform(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                platform === tab.value
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={14} className="text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm text-gray-600 bg-transparent border-none outline-none cursor-pointer font-medium"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl">
        {filteredVideos.map((video) => (
          <button
            key={video.id}
            onClick={() => setSelectedVideo(video)}
            className="group relative aspect-[9/16] md:aspect-[3/4] lg:aspect-[4/5] max-h-[400px] rounded-xl overflow-hidden bg-gray-100 text-left"
          >
            <VideoThumbnail video={video} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200" />

            {/* Play icon center */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                <Play size={20} className="text-gray-900 ml-0.5" />
              </div>
            </div>

            {/* Platform badge */}
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-md text-xs text-white font-medium uppercase">
              {video.platform}
            </span>

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
              {video.caption && (
                <p className="text-white text-xs line-clamp-2 mb-1.5">{video.caption}</p>
              )}
              <div className="flex items-center gap-3 text-white/80 text-xs">
                {video.like_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart size={12} />
                    {formatCount(video.like_count)}
                  </span>
                )}
                {video.view_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    {formatCount(video.view_count)}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No {platform !== 'all' ? platform : ''} videos found
        </div>
      )}

      {/* Modal overlay */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal()
          }}
        >
          <div className="max-h-[90vh] overflow-y-auto">
            <VideoEmbed video={selectedVideo} onClose={handleCloseModal} />
          </div>
        </div>
      )}
    </div>
  )
}
