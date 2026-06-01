'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * ScoreSparkline — tiny inline trend line of a restaurant's rating history.
 *
 * Self-fetches up to ~90 days of rows from `restaurant_rating_snapshots`
 * for the given restaurant, ordered by snapshot date, and draws a minimal
 * SVG sparkline of the Google rating trend (garnet stroke).
 *
 * Degrades silently — returns null and never throws when:
 *   - the env/client is misconfigured or the query errors,
 *   - the table is missing / not yet populated in the live DB,
 *   - fewer than 2 usable data points exist.
 * The snapshots table is documented but may be empty in the live DB, so
 * the absence of data is an expected, non-error condition.
 *
 * Columns used: `snapshot_date` (ordering / x-axis) and `google_rating`
 * (y-axis value). Both are selected defensively and guarded for null.
 */
export default function ScoreSparkline({
  restaurantId,
  className,
}: {
  restaurantId: string
  className?: string
}) {
  const [points, setPoints] = useState<number[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const supabase = createClient()

        // ~90 days back from today.
        const since = new Date()
        since.setDate(since.getDate() - 90)
        const sinceIso = since.toISOString().slice(0, 10)

        const { data, error } = await supabase
          .from('restaurant_rating_snapshots')
          .select('snapshot_date, google_rating')
          .eq('restaurant_id', restaurantId)
          .gte('snapshot_date', sinceIso)
          .order('snapshot_date', { ascending: true })
          .limit(90)

        if (cancelled) return

        // Table missing, RLS block, or any query failure -> degrade silently.
        if (error || !data) {
          setPoints(null)
          return
        }

        const values = data
          .map((row) =>
            typeof row?.google_rating === 'number' ? row.google_rating : null
          )
          .filter((v): v is number => v !== null && Number.isFinite(v))

        setPoints(values.length >= 2 ? values : null)
      } catch {
        // Never crash the page on a sparkline.
        if (!cancelled) setPoints(null)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  if (!points || points.length < 2) return null

  const width = 64
  const height = 20
  const pad = 2
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const stepX = (width - pad * 2) / (points.length - 1)

  const d = points
    .map((value, i) => {
      const x = pad + i * stepX
      const y = pad + (1 - (value - min) / span) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label="Rating trend over the last 90 days"
    >
      <path
        d={d}
        stroke="var(--color-action)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
