'use client'

import { useState } from 'react'
import Link from 'next/link'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'

interface ExploreCollectionCardProps {
  title: string
  description: string
  image: string
  count: number
  curator: string
  href: string
  /** Optional 1/2/3 star breakdown rendered as a third line under the
   *  count. Only set for the Michelin Stars tile so the user can see
   *  the prestige distribution in the active city before clicking in.
   */
  breakdown?: { one: number; two: number; three: number } | null
}

/**
 * Categories tile — photo + title + curator + count, optionally with a
 * Michelin star-count breakdown.
 *
 * Tightened from the original Figma editorial size (140px image, p-6
 * body, full description paragraph) so 4 tiles fit per row on desktop
 * and the Categories grid stops dwarfing the rest of the page. The
 * description used to live here too, but with 7 categories it pushed
 * the grid below the fold; the title alone is descriptive enough for
 * "Michelin Stars", "Bib Gourmand", "Eater 38".
 */
export default function ExploreCollectionCard({
  title,
  image,
  count,
  curator,
  href,
  breakdown,
}: ExploreCollectionCardProps) {
  const [src, setSrc] = useState(image)
  const [didFallback, setDidFallback] = useState(false)

  return (
    <Link
      href={href}
      className="group block rounded-sm shadow-sm overflow-hidden transition-all hover:shadow-xl cursor-pointer h-full"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div
        className="overflow-hidden relative rounded-sm"
        style={{ height: '108px' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${title} collection`}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
          onError={() => {
            if (didFallback) return
            setDidFallback(true)
            setSrc(FALLBACK_IMAGE)
          }}
        />
      </div>
      <div className="p-4">
        <h3
          className="text-lg mb-2"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
          }}
        >
          {title}
        </h3>

        {breakdown && (
          <p
            className="text-xs mb-2"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
            aria-label={`Michelin breakdown: ${breakdown.three} three-star, ${breakdown.two} two-star, ${breakdown.one} one-star`}
          >
            {breakdown.three > 0 && (
              <span className="mr-2">★★★ {breakdown.three}</span>
            )}
            {breakdown.two > 0 && (
              <span className="mr-2">★★ {breakdown.two}</span>
            )}
            {breakdown.one > 0 && <span>★ {breakdown.one}</span>}
          </p>
        )}

        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.10em',
            }}
          >
            {curator}
          </span>
          <span
            className="text-sm"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
            }}
          >
            {count} places
          </span>
        </div>
      </div>
    </Link>
  )
}
