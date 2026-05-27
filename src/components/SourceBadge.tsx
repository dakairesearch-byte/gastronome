'use client'

import { useState } from 'react'
import type { SourceRating } from '@/types/database'

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  google: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  yelp: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  infatuation: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  beli: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

interface SourceBadgeProps {
  source: SourceRating
  compact?: boolean
}

export default function SourceBadge({ source, compact = false }: SourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const colors = colorMap[source.source] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }

  if (source.rating === null) return null

  // Always show the denominator ("4.3 / 5", "8.1 / 10") so users can
  // tell mixed-scale ratings apart at a glance — without it, 7.0/10
  // looks worse than 4.3/5. Sweep v2 source-attribution QW.
  const ratingDisplay = `${source.rating.toFixed(1)}${source.maxRating ? `/${source.maxRating}` : ''}`

  // Compose an a11y label that combines source name + rating + review
  // count when known, so screen-reader users get the full context the
  // single-letter icon hides from them.
  const ariaLabel = source.reviewCount != null && source.reviewCount > 0
    ? `${source.label}: ${ratingDisplay} from ${source.reviewCount.toLocaleString()} reviews`
    : `${source.label}: ${ratingDisplay}`

  const content = (
    <span
      className={`relative inline-flex items-center ${compact ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm'} rounded-full font-semibold border ${colors.bg} ${colors.text} ${colors.border} transition-colors`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={source.label}
      aria-label={ariaLabel}
    >
      <span className="text-xs font-bold uppercase" aria-hidden="true">{source.icon}</span>
      {!compact && (
        <span className="text-xs font-medium opacity-90" aria-hidden="true">
          {source.label}
        </span>
      )}
      <span aria-hidden="true">{ratingDisplay}</span>

      {/* Tooltip — only useful for the desktop hover path. Mobile users
          now get the source.label inline (non-compact) and the full
          context via aria-label. */}
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
