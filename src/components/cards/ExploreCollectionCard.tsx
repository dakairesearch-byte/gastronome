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
}

/**
 * Figma collection card: photo + title + description + curator + count.
 * Used on the Explore page's "Editorial Collections" section.
 */
export default function ExploreCollectionCard({
  title,
  description,
  image,
  count,
  curator,
  href,
}: ExploreCollectionCardProps) {
  const [src, setSrc] = useState(image)
  const [didFallback, setDidFallback] = useState(false)

  return (
    <Link
      href={href}
      className="group block rounded-sm shadow-md overflow-hidden transition-all hover:shadow-2xl cursor-pointer"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="overflow-hidden relative rounded-sm" style={{ height: '140px' }}>
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
      <div className="p-6">
        <h3
          className="text-2xl mb-3"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
          }}
        >
          {title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-5"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            lineHeight: '1.6',
          }}
        >
          {description}
        </p>
        <div
          className="flex items-center justify-between pt-4 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span
            className="text-xs uppercase tracking-wider"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.08em',
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
