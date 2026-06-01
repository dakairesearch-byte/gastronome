import { gastronomeScore } from '@/lib/score'
import type { Restaurant } from '@/types/database'

/**
 * ConsensusMeter — a compact, single-glance visual encoding of the
 * Gastronome Score and how trustworthy it is. Replaces the prominent
 * SourceRatingsBar on cards: instead of four raw badges competing for
 * attention, it leads with the namesake aggregate number and conveys
 * *agreement* and *coverage* — the two things that tell a user how much
 * to trust an 8.4.
 *
 * It encodes four signals, in <=2 hues (neutral track + garnet action):
 *  1. SCORE BAR — a 0–10 fill (garnet) showing the headline number.
 *  2. AGREEMENT BAND — a lighter garnet band drawn around the score
 *     spanning the min/max of the contributing sources' normalized
 *     scores. A wide band = sources disagree; a tight band = consensus.
 *  3. COVERAGE DOTS — one dot per possible source (maxSources); filled
 *     (garnet) when that source contributed, hollow (neutral) when
 *     missing. Communicates "N of 4 sources" honestly.
 *  4. VOLUME GLYPH — a small bar whose width grows with log(reviews),
 *     so a score from 4,000 reviews reads as weightier than one from 12.
 *
 * Design tokens only. Returns null when there is no score at all (the
 * card should show nothing rather than an empty meter).
 *
 * SHARED CONTRACT (C3): default export ConsensusMeter({ restaurant }).
 */
export default function ConsensusMeter({
  restaurant,
}: {
  restaurant: Restaurant
}) {
  const score = gastronomeScore(restaurant)
  if (!score) return null

  const { score: value, breakdown, contributingSources, maxSources, reviewCount } = score

  // Agreement band: span of the contributing sources on the same 0–10
  // scale. With a single source there is no spread, so the band collapses
  // to a hairline at the score itself.
  const normals = breakdown.map((c) => c.normalized)
  const lo = normals.length ? Math.min(...normals) : value
  const hi = normals.length ? Math.max(...normals) : value
  const loPct = clampPct(lo * 10)
  const hiPct = clampPct(hi * 10)
  const scorePct = clampPct(value * 10)
  // Spread width as a fraction of the 0–10 axis, for the sr-only summary.
  const spread = hi - lo
  const agreementLabel =
    breakdown.length <= 1
      ? 'single source'
      : spread <= 1
        ? 'sources agree closely'
        : spread <= 2.5
          ? 'sources mostly agree'
          : 'sources disagree'

  // Volume glyph width: log-scaled so the bar saturates rather than
  // letting one mega-reviewed place dwarf everything. ~10 reviews → tiny,
  // ~5,000+ → full. Hidden entirely when no source reports a count.
  const hasVolume = reviewCount != null && reviewCount > 0
  const volumePct = hasVolume
    ? clampPct((Math.log10(reviewCount) / Math.log10(5000)) * 100)
    : 0

  const filledDots = contributingSources.length

  const srSummary =
    `Gastronome Score ${value.toFixed(1)} out of 10, ` +
    `${filledDots} of ${maxSources} sources, ${agreementLabel}` +
    (hasVolume ? `, ${reviewCount!.toLocaleString()} reviews` : '') +
    '.'

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[15rem]" role="group">
      <span className="sr-only">{srSummary}</span>

      {/* Headline: number + coverage dots */}
      <div className="flex items-center justify-between gap-2" aria-hidden="true">
        <span
          className="inline-flex items-baseline gap-0.5 leading-none font-bold text-sm"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-secondary)' }}
        >
          {value.toFixed(1)}
          <span
            className="text-[9px] font-normal"
            style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}
          >
            /10
          </span>
        </span>

        {/* Coverage dots — filled = source present. */}
        <span className="flex items-center gap-1">
          {Array.from({ length: maxSources }).map((_, i) => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full"
              style={
                i < filledDots
                  ? { backgroundColor: 'var(--color-action)' }
                  : {
                      backgroundColor: 'transparent',
                      boxShadow: 'inset 0 0 0 1px var(--color-border)',
                    }
              }
            />
          ))}
        </span>
      </div>

      {/* Score bar with agreement band overlay. The track is neutral; the
          fill and band are garnet at two opacities (still <=2 hues). */}
      <div
        className="relative w-full h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-skeleton-base)' }}
        aria-hidden="true"
      >
        {/* Agreement band — faint garnet spanning min→max of the sources. */}
        <span
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${loPct}%`,
            width: `${Math.max(hiPct - loPct, 1.5)}%`,
            backgroundColor: 'var(--color-action)',
            opacity: 0.22,
          }}
        />
        {/* Score fill — solid garnet up to the headline value. */}
        <span
          className="absolute top-0 bottom-0 left-0 rounded-full"
          style={{ width: `${scorePct}%`, backgroundColor: 'var(--color-action)' }}
        />
        {/* Score tick — a crisp marker at the exact score. */}
        <span
          className="absolute top-0 bottom-0 w-px"
          style={{ left: `${scorePct}%`, backgroundColor: 'var(--color-surface)', opacity: 0.85 }}
        />
      </div>

      {/* Volume glyph — log-scaled bar, only when a count exists. */}
      {hasVolume && (
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span
            className="relative h-1 flex-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-skeleton-base)' }}
          >
            <span
              className="absolute top-0 bottom-0 left-0 rounded-full"
              style={{ width: `${volumePct}%`, backgroundColor: 'var(--color-action)', opacity: 0.45 }}
            />
          </span>
          <span
            className="text-[10px] leading-none whitespace-nowrap"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {formatVolume(reviewCount!)} reviews
          </span>
        </div>
      )}
    </div>
  )
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n))
}

/** Compact review-count label: 1,240 → 1.2k, 4,000,000 → 4M. */
function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return n.toLocaleString()
}
