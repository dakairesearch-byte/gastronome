'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heart, Eye, Play, SlidersHorizontal } from 'lucide-react'
import type { RestaurantVideo } from '@/types/database'
import VideoEmbed from './VideoEmbed'

type Platform = 'all' | 'tiktok' | 'instagram'
type SortOption = 'most_liked' | 'most_viewed' | 'newest'

interface VideoGalleryProps {
  restaurantId: string
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toLocaleString()
}

export default function VideoGallery({ restaurantId }: VideoGalleryProps) {
  const [videos, setVideos] = useState<RestaurantVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<Platform>('all')
  const [sortBy, setSortBy] = useState<SortOption>('most_liked')
  const [selectedVideo, setSelectedVideo] = useState<RestaurantVideo | null>(null)

  useEffect(() => {
    async function fetchVideos() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/restaurants/videos?restaurantId=${encodeURIComponent(restaurantId)}`)
        if (!res.ok) throw new Error('Failed to fetch videos')
        const data = await res.json()
        setVideos(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load videos')
      } finally {
        setLoading(false)
      }
    }
    fetchVideos()
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] bg-gray-100 rounded-xl animate-pulse" />
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
      <div className="text-center py-8 text-gray-400">
        <Play size={32} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No videos yet</p>
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredVideos.map((video) => (
          <button
            key={video.id}
            onClick={() => setSelectedVideo(video)}
            className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 text-left"
          >
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt={video.caption || 'Video thumbnail'}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Play size={32} className="text-emerald-400" />
              </div>
            )}

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
