/**
 * VerdictCard — "The Verdict" cross-source consensus card (report #56, Stage 1).
 *
 * Shows a plain-English consensus verdict derived from the per-source
 * normalized spread in gastronomeScore().breakdown, plus per-source mini-bars
 * (source name, native rating, normalized 0-10 fill).
 *
 * Server component — pure display from a precomputed GastronomeScore. Renders
 * nothing when score is null.
 *
 * Tier logic lives in src/lib/verdict.ts; this file owns only the presentation.
 */

import type { GastronomeScore } from '@/lib/score'
import { computeVerdict } from '@/lib/verdict'

function tierLabel(score: GastronomeScore): { headline: string; subline: string } {
  const { tier, spread, high, low } = computeVerdict(score.breakdown)

  switch (tier.kind) {
    case 'single':
      return {
        headline: 'Single source — uncorroborated',
        subline: 'Only one rating feeds this score. More sources would sharpen the picture.',
      }
    case 'unanimous':
      return {
        headline: 'Unanimous: every crowd agrees',
        subline: `Sources land within ${spread.toFixed(1)} points of each other on the 0-10 scale — a rare consensus.`,
      }
    case 'broad':
      return {
        headline: 'Broad agreement',
        subline: `Sources mostly align — a ${spread.toFixed(1)}-point spread, well within normal variation.`,
      }
    case 'contested': {
      // e.g. "Critics love it, Yelp shrugs"
      const highVerb = high >= 8.5 ? 'loves it' : high >= 7 ? 'rates it highly' : 'leans positive'
      const lowVerb = low <= 5 ? 'shrugs' : low <= 6.5 ? 'is lukewarm' : 'is cooler'
      return {
        headline: `Contested: ${tier.highSource} ${highVerb}, ${tier.lowSource} ${lowVerb}`,
        subline: `A ${spread.toFixed(1)}-point spread. Read both sources before deciding.`,
      }
    }
  }
}

function verdictAccentStyle(kind: string): { backgroundColor: string; color: string } {
  // Unanimous → green tint; Broad → amber tint; Contested → garnet tint; Single → muted.
  switch (kind) {
    case 'unanimous':
      return { backgroundColor: 'rgba(22,163,74,0.10)', color: '#15803d' }
    case 'broad':
      return { backgroundColor: 'rgba(202,138,4,0.12)', color: '#92400e' }
    case 'contested':
      return { backgroundColor: 'rgba(142,59,70,0.10)', color: 'var(--color-action)' }
    default:
      return { backgroundColor: 'rgba(94,94,94,0.10)', color: 'var(--color-text-secondary)' }
  }
}

export default function VerdictCard({ score }: { score: GastronomeScore | null }) {
  if (!score) return null

  const { headline, subline } = tierLabel(score)
  const { tier } = computeVerdict(score.breakdown)

  return (
    <section aria-label="The Verdict">
      {/* Section header — mirrors the ConsensusBreakdown pattern exactly. */}
      <div className="mb-3.5">
        <span
          className="text-xs uppercase block mb-2.5"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.18em',
            fontWeight: 500,
          }}
        >
          Cross-source read
        </span>
        <h2
          className="text-2xl"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            color: 'var(--color-text)',
            letterSpacing: '-0.005em',
          }}
        >
          The Verdict
        </h2>
        <div
          className="mt-3.5"
          style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
        />
      </div>

      <div
        className="px-5 py-5 sm:px-6 sm:py-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
        }}
      >
        {/* Verdict pill + headline copy */}
        <div className="mb-4">
          <span
            className="inline-block text-xs px-2.5 py-1 mb-2"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              borderRadius: '999px',
              ...verdictAccentStyle(tier.kind),
            }}
          >
            {headline}
          </span>
          <p
            className="text-sm"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {subline}
          </p>
        </div>

        {/* Per-source mini-bars */}
        <ul
          className="space-y-3"
          aria-label="Per-source ratings"
        >
          {score.breakdown.map((c) => {
            const fillPct = Math.max(0, Math.min(100, c.normalized * 10))
            return (
              <li key={c.source} style={{ fontFamily: 'var(--font-body)' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-text)', fontWeight: 600 }}
                  >
                    {c.source}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {c.native.toFixed(1)}&thinsp;/&thinsp;{c.nativeMax}
                    <span
                      className="ml-2"
                      style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}
                    >
                      ({c.normalized.toFixed(1)}&thinsp;/&thinsp;10)
                    </span>
                  </span>
                </div>
                {/* 0-10 fill bar */}
                <div
                  className="relative w-full rounded-full"
                  style={{
                    height: 6,
                    backgroundColor: 'var(--color-skeleton-base)',
                  }}
                  aria-hidden="true"
                >
                  <span
                    className="absolute top-0 bottom-0 left-0 rounded-full"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: 'var(--color-action)',
                      opacity: 0.75,
                    }}
                  />
                </div>
                <span className="sr-only">
                  {c.source}: {c.native.toFixed(1)} out of {c.nativeMax} native ({c.normalized.toFixed(1)} out of 10 normalized).
                </span>
              </li>
            )
          })}
        </ul>

        {/* Axis labels — anchor the bars' scale. */}
        <div
          className="flex justify-between mt-1 text-[10px]"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
          aria-hidden="true"
        >
          <span>0</span>
          <span>10</span>
        </div>
      </div>
    </section>
  )
}
