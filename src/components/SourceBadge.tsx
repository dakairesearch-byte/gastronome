'use client'

import { useState } from 'react'
import type { SourceRating } from '@/types/database'

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  google: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  yelp: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  infatuation: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
}

interface SourceBadgeProps {
  source: SourceRating
  compact?: boolean
}

export default function SourceBadge({ source, compact = false }: SourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const colors = colorMap[source.source] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }

  if (source.rating === null) return null

  const content = (
    <span
      className={`relative inline-flex items-center ${compact ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm'} rounded-full font-semibold border ${colors.bg} ${colors.text} ${colors.border} transition-colors`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-xs font-bold uppercase">{source.icon}</span>
      <span>{source.rating.toFixed(2)}{source.maxRating ? `/${source.maxRating}` : ''}</span>

      {/* Tooltip */}
      {showTooltip && source.reviewCount != null && source.reviewCount > 0 && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg pointer-events-none z-10">
          {source.reviewCount.toLocaleString()} {source.reviewCount === 1 ? 'review' : 'reviews'}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    )
  }

  return content
}
