'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export type FeedFilter = 'all' | 'restaurants' | 'videos' | 'reviews' | 'photos'

const CHIPS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'restaurants', label: 'Restaurants Added' },
  { key: 'videos', label: 'Videos' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'photos', label: 'Photos' },
]

interface FeedFilterChipsProps {
  active: FeedFilter
}

/**
 * Sticky filter chips at the top of /recent. Controls which event kinds
 * are shown. URL-driven via `?filter=...` so links are shareable.
 */
export default function FeedFilterChips({ active }: FeedFilterChipsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const onClick = useCallback(
    (key: FeedFilter) => {
      const params = new URLSearchParams(searchParams.toString())
      if (key === 'all') params.delete('filter')
      else params.set('filter', key)
      const qs = params.toString()
      startTransition(() => {
        router.push(qs ? `/recent?${qs}` : '/recent')
      })
    },
    [router, searchParams]
  )

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {CHIPS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onClick(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
            active === key
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
