/**
 * Top 10 Trending — the Figma v23 editorial list + map panel.
 *
 * Two-column layout on desktop: a numbered 1…10 list of restaurants on the
 * left (circle index, name, CUISINE • neighborhood, star rating) and a
 * decorative map panel on the right with numbered pins that echo the list
 * order. On mobile the two columns stack and the map panel is hidden to
 * keep the list readable.
 *
 * This component is intentionally presentational — the caller selects the
 * 10 trending restaurants (via `rankScores` / `computeAllScores`) and the
 * city label, so it can be reused as cities change. When latitude /
 * longitude are available the pins are positioned proportionally; when
 * they are not, we fall back to a deterministic scatter so the panel
 * never looks empty.
 */

import SectionHeader from '@/components/SectionHeader'
import { Star } from 'lucide-react'
import type { Restaurant } from '@/types/database'

interface Top10TrendingProps {
  city: string
  restaurants: Restaurant[]
}

/** Deterministic fallback positions (percent of panel), used when a
 *  restaurant has no lat/lng. Tuned to roughly match the Figma Make
 *  layout where pins cluster near the center. */
const FALLBACK_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 26, y: 72 },
  { x: 54, y: 82 },
  { x: 70, y: 56 },
  { x: 60, y: 86 },
  { x: 50, y: 70 },
  { x: 40, y: 46 },
  { x: 34, y: 68 },
  { x: 38, y: 78 },
  { x: 76, y: 32 },
  { x: 58, y: 58 },
]

function getRating(r: Restaurant): number | null {
  if (typeof r.google_rating === 'number') return r.google_rating
  if (typeof r.avg_rating === 'number') return r.avg_rating
  return null
}

function pinPosition(
  r: Restaurant,
  index: number,
  bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  } | null,
) {
  if (
    bounds &&
    typeof r.latitude === 'number' &&
    typeof r.longitude === 'number'
  ) {
    const latRange = bounds.maxLat - bounds.minLat || 1
    const lngRange = bounds.maxLng - bounds.minLng || 1
    // 8% padding inside the panel so pins never sit on the border.
    const x = 8 + ((r.longitude - bounds.minLng) / lngRange) * 84
    const y = 8 + (1 - (r.latitude - bounds.minLat) / latRange) * 84
    return { x, y }
  }
  return FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length]
}

export default function Top10Trending({ city, restaurants }: Top10TrendingProps) {
  if (restaurants.length === 0) return null

  const items = restaurants.slice(0, 10)

  // Compute geographic bounds if every restaurant has lat/lng. If any pin
  // is missing coordinates we skip bounds entirely and use the fallback
  // scatter so the panel stays visually balanced.
  const lats = items
    .map((r) => r.latitude)
    .filter((v): v is number => typeof v === 'number')
  const lngs = items
    .map((r) => r.longitude)
    .filter((v): v is number => typeof v === 'number')
  const bounds =
    lats.length === items.length && lngs.length === items.length
      ? {
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
        }
      : null

  return (
    <section className="mb-16">
      <SectionHeader label={city.toUpperCase()} title="Top 10 Trending" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* --- Numbered list --- */}
        <ol className="flex flex-col">
          {items.map((r, i) => {
            const rank = i + 1
            const rating = getRating(r)
            return (
              <li
                key={r.id}
                className="flex items-start gap-4 py-4 border-b"
                style={{ borderColor: 'var(--color-border, rgba(0,0,0,0.08))' }}
              >
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: 'var(--color-surface-alt, #F3EFE7)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                  }}
                >
                  {rank}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3
                      className="text-lg truncate"
                      style={{
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 500,
                      }}
                    >
                      {r.name}
                    </h3>
                    {rating != null && (
                      <span
                        className="flex items-center gap-1 text-sm flex-shrink-0"
                        style={{
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        <Star
                          size={14}
                          className="flex-shrink-0"
                          style={{
                            color: 'var(--color-accent)',
                            fill: 'var(--color-accent)',
                          }}
                        />
                        {rating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div
                    className="mt-1 flex items-center gap-2 text-xs"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <span
                      className="uppercase"
                      style={{ letterSpacing: '0.14em' }}
                    >
                      {r.cuisine}
                    </span>
                    {r.neighborhood && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>{r.neighborhood}</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {/* --- Map panel (decorative; pins echo the list order) --- */}
        <div
          className="hidden lg:block relative rounded-sm overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface-alt, #EFEAE1)',
            minHeight: '520px',
          }}
          aria-hidden="true"
        >
          {/* Subtle grid lines, evoke a streetmap without being one. */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ opacity: 0.45 }}
          >
            <defs>
              <pattern
                id="top10-grid"
                width="64"
                height="64"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 64 0 L 0 0 0 64"
                  fill="none"
                  stroke="var(--color-border, rgba(0,0,0,0.08))"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#top10-grid)" />
          </svg>

          {items.map((r, i) => {
            const { x, y } = pinPosition(r, i, bounds)
            return (
              <div
                key={r.id}
                className="absolute flex items-center justify-center rounded-full text-[11px] shadow-md"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '26px',
                  height: '26px',
                  backgroundColor: 'var(--color-text)',
                  color: 'var(--color-background)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {i + 1}
              </div>
            )
          })}

          {/* City label caption */}
          <div
            className="absolute bottom-4 left-4 px-3 py-1.5 text-xs uppercase rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.14em',
            }}
          >
            {city}
          </div>
        </div>
      </div>
    </section>
  )
}
