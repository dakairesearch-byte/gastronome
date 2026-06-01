'use client'

import { useState } from 'react'
import type { SourceRating } from '@/types/database'

// Per-source identity hues. These encode each *external* source's own
// brand (Google blue, Yelp red, etc.) — they are intentionally NOT the
// Gastronome accent. Expressed as a single seed hex per source; the
// pale fill / readable text / hairline border are derived from it via
// color-mix so we keep one source of truth instead of three raw
// Tailwind classes. The neutral fallback derives from design tokens.
const sourceSeed: Record<string, string> = {
  google: '#1a73e8',
  yelp: '#d32323',
  infatuation: '#e8590c',
  beli: '#7c3aed',
}

function seedStyle(seed: string) {
  return {
    backgroundColor: `color-mix(in srgb, ${seed} 8%, var(--color-surface))`,
    color: `color-mix(in srgb, ${seed} 78%, var(--color-text))`,
    borderColor: `color-mix(in srgb, ${seed} 28%, var(--color-border))`,
  }
}

const fallbackStyle = {
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  borderColor: 'var(--color-border)',
}

interface SourceBadgeProps {
  source: SourceRating
  compact?: boolean
}

export default function SourceBadge({ source, compact = false }: SourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const seed = sourceSeed[source.source]
  const chipStyle = seed ? seedStyle(seed) : fallbackStyle

  if (source.rating === null) return null

  const hasCount = source.reviewCount != null && source.reviewCount > 0

  // Always show the denominator ("4.3 / 5", "8.1 / 10") so users can
  // tell mixed-scale ratings apart at a glance — without it, 7.0/10
  // looks worse than 4.3/5. Sweep v2 source-attribution QW.
  const ratingDisplay = `${source.rating.toFixed(1)}${source.maxRating ? `/${source.maxRating}` : ''}`

  // Compose an a11y label that combines source name + rating + review
  // count when known, so screen-reader users get the full context the
  // single-letter icon hides from them.
  const ariaLabel = hasCount
    ? `${source.label}: ${ratingDisplay} from ${source.reviewCount!.toLocaleString()} reviews`
    : `${source.label}: ${ratingDisplay}`

  const content = (
    <span
      className={`relative inline-flex items-center ${compact ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm'} rounded-full font-semibold border transition-colors`}
      style={chipStyle}
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
      {/* Surface the review count inline (was hover-only via title). Kept
          subtle and hidden in compact chips to avoid crowding rails. */}
      {!compact && hasCount && (
        <span
          className="text-xs font-normal"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden="true"
        >
          ({source.reviewCount!.toLocaleString()})
        </span>
      )}

      {/* Tooltip — desktop hover affordance; mobile gets the inline count
          (non-compact) and full context via aria-label. */}
      {showTooltip && hasCount && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-white text-xs rounded-lg whitespace-nowrap shadow-lg pointer-events-none z-10"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          {source.reviewCount!.toLocaleString()} {source.reviewCount === 1 ? 'review' : 'reviews'}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: 'var(--color-secondary)' }}
          />
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
