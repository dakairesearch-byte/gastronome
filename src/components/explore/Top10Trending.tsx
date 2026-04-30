'use client'

/**
 * Top 10 Trending — the Figma v23 editorial list + map panel.
 *
 * Two-column layout on desktop: a numbered 1…10 list of restaurants on the
 * left (circle index, name, CUISINE • neighborhood, star rating) and a map
 * panel on the right with numbered pins positioned by lat/lng. On mobile
 * the two columns stack and the map panel is hidden to keep the list
 * readable.
 *
 * The caller picks the 10 trending restaurants via `topTrendingRestaurants`
 * and the city label, so this component is agnostic to the ranking. When
 * lat/lng is available we compute a geographic bbox and place pins
 * proportionally; when coordinates are missing for any row we fall back to
 * a deterministic scatter so the panel never looks empty.
 *
 * Interactivity (client-side):
 *   - List rows are `<Link>`s to the restaurant detail page.
 *   - Hovering a row highlights its pin, and hovering a pin highlights its
 *     row — the two always stay paired.
 *   - Pins are `<Link>`s too, so users can jump straight from the map.
 */

import Link from 'next/link'
import { useState } from 'react'
import { Star } from 'lucide-react'
import SectionHeader from '@/components/SectionHeader'
import {
  BibGourmandIcon,
  EaterIcon,
  GoogleGIcon,
  JamesBeardIcon,
  MichelinStarIcon,
  YelpIcon,
} from '@/components/brands/BrandIcons'
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

/**
 * Accolades to render on the right-side cluster. Each badge now renders
 * the source's actual brand mark (Michelin rosette, Bibendum for Bib
 * Gourmand, James Beard medallion, Eater E) instead of a generic lucide
 * icon. Michelin stars are rendered as N repeated rosettes so the count
 * is visible at a glance — that's how the Michelin Guide itself surfaces
 * them on cards.
 */
type Accolade =
  | {
      key: string
      kind: 'michelin-stars'
      stars: number
      label: string
    }
  | {
      key: string
      kind: 'bib' | 'michelin-other' | 'james-beard' | 'eater-38'
      label: string
    }

function getAccolades(r: Restaurant): Accolade[] {
  const out: Accolade[] = []
  const stars = r.michelin_stars ?? 0
  if (stars > 0) {
    out.push({
      key: 'michelin-stars',
      kind: 'michelin-stars',
      stars,
      label: stars === 1 ? '1 Michelin Star' : `${stars} Michelin Stars`,
    })
  } else if (r.michelin_designation === 'bib_gourmand') {
    out.push({ key: 'bib', kind: 'bib', label: 'Bib Gourmand' })
  } else if (r.michelin_designation) {
    out.push({
      key: 'michelin-other',
      kind: 'michelin-other',
      label: 'Michelin Guide',
    })
  }
  if (r.james_beard_winner) {
    out.push({
      key: 'james-beard',
      kind: 'james-beard',
      label: r.james_beard_winner ? 'James Beard Winner' : 'James Beard Nominee',
    })
  }
  if (r.eater_38) {
    out.push({ key: 'eater-38', kind: 'eater-38', label: 'Eater 38' })
  }
  return out
}

function AccoladeBadge({ accolade }: { accolade: Accolade }) {
  const pill =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-white border border-gray-200'
  if (accolade.kind === 'michelin-stars') {
    return (
      <span
        className={pill}
        title={accolade.label}
        aria-label={accolade.label}
      >
        {Array.from({ length: accolade.stars }).map((_, i) => (
          <MichelinStarIcon key={i} size={12} />
        ))}
      </span>
    )
  }
  if (accolade.kind === 'bib' || accolade.kind === 'michelin-other') {
    return (
      <span
        className={pill}
        title={accolade.label}
        aria-label={accolade.label}
      >
        <BibGourmandIcon size={13} />
      </span>
    )
  }
  if (accolade.kind === 'james-beard') {
    return (
      <span
        className={pill}
        title={accolade.label}
        aria-label={accolade.label}
      >
        <JamesBeardIcon size={13} />
      </span>
    )
  }
  return (
    <span className={pill} title={accolade.label} aria-label={accolade.label}>
      <EaterIcon size={13} />
    </span>
  )
}

/** Web Mercator Y projection. Used for lat→panel-Y so pins stay
 *  proportional to the underlying geography even for north/south-slanted
 *  cities. Web Mercator for `lat` in degrees. */
function latToMercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
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
    const lngRange = bounds.maxLng - bounds.minLng || 1
    const minY = latToMercatorY(bounds.minLat)
    const maxY = latToMercatorY(bounds.maxLat)
    const yRange = maxY - minY || 1
    // 5% padding — must match the iframe bbox padding above so pins
    // align with the OpenStreetMap render. (5/110 ≈ 4.55%, rounded to 5
    // for visual cushion.)
    const x = 5 + ((r.longitude - bounds.minLng) / lngRange) * 90
    const y = 5 + (1 - (latToMercatorY(r.latitude) - minY) / yRange) * 90
    return { x, y }
  }
  return FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length]
}

export default function Top10Trending({ city, restaurants }: Top10TrendingProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  if (restaurants.length === 0) return null

  const items = restaurants.slice(0, 10)

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
      <SectionHeader
        label={city.toUpperCase()}
        title={
          items.length >= 10
            ? 'Top 10 Trending'
            : `Top ${items.length} Trending`
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* --- Numbered list --- */}
        <ol className="flex flex-col">
          {items.map((r, i) => {
            const rank = i + 1
            const googleRating = typeof r.google_rating === 'number' ? r.google_rating : null
            const yelpRating = typeof r.yelp_rating === 'number' ? r.yelp_rating : null
            const fallbackRating = googleRating == null && yelpRating == null ? getRating(r) : null
            const accolades = getAccolades(r)
            const isActive = activeId === r.id
            return (
              <li
                key={r.id}
                className="border-b"
                style={{ borderColor: 'var(--color-border, rgba(0,0,0,0.08))' }}
              >
                <Link
                  href={`/restaurants/${r.id}`}
                  onMouseEnter={() => setActiveId(r.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(r.id)}
                  onBlur={() => setActiveId(null)}
                  className="flex items-start gap-4 py-4 transition-colors"
                  style={{
                    backgroundColor: isActive
                      ? 'var(--color-surface, rgba(0,0,0,0.02))'
                      : 'transparent',
                  }}
                >
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-surface-alt, #F3EFE7)',
                      color: isActive
                        ? '#fff'
                        : 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                    }}
                  >
                    {rank}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
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

                        {accolades.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {accolades.map((a) => (
                              <AccoladeBadge key={a.key} accolade={a} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Rating cluster — Google + Yelp stacked vertically
                          on the right edge. Each row renders the source's
                          actual brand mark (4-color Google G, red Yelp
                          burst) so scale attribution is immediate. If
                          both are missing we fall back to whatever
                          getRating() surfaces, labeled with a lucide star. */}
                      <div
                        className="flex-shrink-0 flex flex-col items-end gap-1 text-sm"
                        style={{
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {googleRating != null && (
                          <span
                            className="inline-flex items-center gap-1.5"
                            aria-label={`Google rating ${googleRating.toFixed(1)}`}
                          >
                            <GoogleGIcon size={14} title="Google" />
                            <span>{googleRating.toFixed(1)}</span>
                          </span>
                        )}
                        {yelpRating != null && (
                          <span
                            className="inline-flex items-center gap-1.5"
                            aria-label={`Yelp rating ${yelpRating.toFixed(1)}`}
                          >
                            <YelpIcon size={14} title="Yelp" />
                            <span>{yelpRating.toFixed(1)}</span>
                          </span>
                        )}
                        {fallbackRating != null && (
                          <span className="inline-flex items-center gap-1.5">
                            <Star
                              size={12}
                              className="flex-shrink-0"
                              style={{
                                color: 'var(--color-accent)',
                                fill: 'var(--color-accent)',
                              }}
                            />
                            {fallbackRating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>

        {/* --- Map panel --- */}
        <div
          className="hidden lg:block relative rounded-sm overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface-alt, #EFEAE1)',
            minHeight: '520px',
          }}
          role="img"
          aria-label={`Map with ${items.length} numbered pins showing trending restaurants in ${city}`}
        >
          {/* Real OpenStreetMap centered on the bbox of the visible
              restaurants. No API key required, dynamic per city. The pin
              overlay below uses the *same* bounds, so pins stay aligned
              with the rendered streets/landmarks. We pad the bbox by 5%
              to match the pin layout's 10% inset and avoid pins sitting
              on the map's exact edge.

              Falls back to a beige+grid SVG when no restaurant has a
              lat/lng (caller may pre-populate; never expected in prod). */}
          {bounds && Number.isFinite(bounds.minLat) ? (() => {
            const lngPad = Math.max(0.005, (bounds.maxLng - bounds.minLng) * 0.05)
            const latPad = Math.max(0.005, (bounds.maxLat - bounds.minLat) * 0.05)
            const bbox = [
              bounds.minLng - lngPad,
              bounds.minLat - latPad,
              bounds.maxLng + lngPad,
              bounds.maxLat + latPad,
            ].join(',')
            return (
              <iframe
                title={`Map of trending restaurants in ${city}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ border: 0 }}
                loading="lazy"
                aria-hidden
              />
            )
          })() : (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ opacity: 0.45 }}
              aria-hidden
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
          )}

          {items.map((r, i) => {
            const { x, y } = pinPosition(r, i, bounds)
            const isActive = activeId === r.id
            return (
              <Link
                key={r.id}
                href={`/restaurants/${r.id}`}
                onMouseEnter={() => setActiveId(r.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(r.id)}
                onBlur={() => setActiveId(null)}
                aria-label={`${r.name} — rank ${i + 1}`}
                className="absolute flex items-center justify-center rounded-full text-[11px] shadow-md transition-all"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: isActive
                    ? 'translate(-50%, -50%) scale(1.25)'
                    : 'translate(-50%, -50%)',
                  width: '26px',
                  height: '26px',
                  backgroundColor: isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-text)',
                  color: isActive
                    ? '#fff'
                    : 'var(--color-background)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  zIndex: isActive ? 2 : 1,
                }}
              >
                {i + 1}
              </Link>
            )
          })}

          {/* City label caption */}
          <div
            className="absolute bottom-4 left-4 px-3 py-1.5 text-xs uppercase rounded-sm pointer-events-none"
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
