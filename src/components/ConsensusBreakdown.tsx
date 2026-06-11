import type { GastronomeScore } from '@/lib/score'
import { computeVerdict } from '@/lib/verdict'

/**
 * ConsensusBreakdown — "The Consensus" detail-page panel that replaces the
 * old "By the Numbers" equal-width source grid. That grid mixed /5 (Google,
 * Yelp) and /10 (Infatuation, Beli) scales side by side, so a 4.3 and an
 * 8.6 looked like opposite verdicts when they're nearly identical reads.
 *
 * This plots EVERY contributing source on ONE normalized 0–10 axis, draws a
 * spread/agreement band (tight = consensus, wide = polarizing), shows each
 * source's weight in the score model (from gastronomeScore breakdown), and
 * connects the inputs to the headline Gastronome Score with a verdict line —
 * surfacing inline what was previously hidden in the score badge's (i)
 * popover.
 *
 * Server component (pure render from the precomputed score). Design tokens
 * only; the single accent hue is garnet var(--color-action).
 */
export default function ConsensusBreakdown({
  score,
}: {
  score: GastronomeScore
}) {
  const { score: value, breakdown, sourceCount, maxSources, reviewCount } = score

  const normals = breakdown.map((c) => c.normalized)
  const lo = normals.length ? Math.min(...normals) : value
  const hi = normals.length ? Math.max(...normals) : value
  const spread = hi - lo

  // Verdict on agreement — the one-line "how much do they agree?" read.
  // Derived from the SAME tier function as VerdictCard (src/lib/verdict.ts)
  // so the two adjacent panels can never contradict each other on-page.
  const tier = computeVerdict(breakdown).tier
  const verdict =
    tier.kind === 'single'
      ? { label: 'Single source', blurb: 'Only one rating feeds this — treat it as a thin read.' }
      : tier.kind === 'unanimous'
        ? { label: 'Strong consensus', blurb: 'Every source lands within a point of each other.' }
        : tier.kind === 'broad'
          ? { label: 'Broad agreement', blurb: 'Sources mostly line up on this one.' }
          : { label: 'Polarizing', blurb: 'Sources split — read the spread, not just the number.' }

  const pct = (n: number) => Math.max(0, Math.min(100, n * 10))
  const loPct = pct(lo)
  const hiPct = pct(hi)
  const scorePct = pct(value)

  return (
    <section aria-label="The Consensus">
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
          Where every source lands
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
          The Consensus
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
        {/* Headline: the aggregate verdict line connecting inputs → score. */}
        <div className="flex items-end justify-between gap-4 mb-1.5">
          <div>
            <div
              className="leading-none"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: '2.5rem',
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              {value.toFixed(1)}
              <span
                className="text-lg"
                style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}
              >
                {' '}
                / 10
              </span>
            </div>
            <span
              className="text-[11px] uppercase mt-1.5 block"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.12em',
                color: 'var(--color-text-secondary)',
              }}
            >
              Gastronome Score
            </span>
          </div>
          <div className="text-right">
            <span
              className="inline-block text-xs px-2.5 py-1"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                borderRadius: '999px',
                backgroundColor: 'rgba(142,59,70,0.1)',
                color: 'var(--color-action)',
              }}
            >
              {verdict.label}
            </span>
            <span
              className="text-[11px] mt-1.5 block max-w-[14rem]"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.45,
              }}
            >
              {verdict.blurb}
            </span>
          </div>
        </div>

        {/* The shared 0–10 axis: agreement band + score marker. Every
            source dot below plots against this same axis. */}
        <div className="mt-4 mb-2">
          <div
            className="relative w-full h-2.5 rounded-full"
            style={{ backgroundColor: 'var(--color-skeleton-base)' }}
            aria-hidden="true"
          >
            {/* Agreement band — faint garnet spanning min→max of sources. */}
            <span
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                left: `${loPct}%`,
                width: `${Math.max(hiPct - loPct, 1.5)}%`,
                backgroundColor: 'var(--color-action)',
                opacity: 0.2,
              }}
            />
            {/* Score fill up to the headline value. */}
            <span
              className="absolute top-0 bottom-0 left-0 rounded-full"
              style={{ width: `${scorePct}%`, backgroundColor: 'var(--color-action)', opacity: 0.85 }}
            />
            {/* Crisp marker at the exact score. */}
            <span
              className="absolute top-[-3px] bottom-[-3px] w-0.5 rounded-full"
              style={{ left: `${scorePct}%`, backgroundColor: 'var(--color-action)' }}
            />
          </div>
          {/* Axis end-labels so the scale reads unambiguously. */}
          <div
            className="flex justify-between mt-1 text-[10px]"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            aria-hidden="true"
          >
            <span>0</span>
            <span>10</span>
          </div>
        </div>

        {/* Per-source rows: normalized score plotted on the same axis, the
            native rating for context, and the model weight as a small bar. */}
        <ul className="mt-3 space-y-3">
          {breakdown.map((c) => {
            const dotPct = pct(c.normalized)
            return (
              <li key={c.source} style={{ fontFamily: 'var(--font-body)' }}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm" style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                    {c.source}
                    <span
                      className="text-xs ml-1.5"
                      style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}
                    >
                      {c.native.toFixed(1)} / {c.nativeMax}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-[11px] uppercase"
                      style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.08em' }}
                      title={`Weighted ${Math.round(c.weight * 100)}% in the Gastronome Score`}
                    >
                      {Math.round(c.weight * 100)}% weight
                    </span>
                  </span>
                </div>
                {/* Track with the source's normalized position marked, so a
                    /5 Google and a /10 Beli are directly comparable. */}
                <div
                  className="relative w-full h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-skeleton-base)' }}
                  aria-hidden="true"
                >
                  <span
                    className="absolute top-0 bottom-0 left-0 rounded-full"
                    style={{
                      width: `${dotPct}%`,
                      backgroundColor: 'var(--color-action)',
                      opacity: 0.3,
                    }}
                  />
                  <span
                    className="absolute rounded-full"
                    style={{
                      left: `calc(${dotPct}% - 4px)`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 8,
                      height: 8,
                      backgroundColor: 'var(--color-action)',
                      boxShadow: '0 0 0 2px var(--color-surface)',
                    }}
                  />
                </div>
                <span className="sr-only">
                  {c.source}: {c.normalized.toFixed(1)} out of 10, weighted{' '}
                  {Math.round(c.weight * 100)} percent.
                </span>
              </li>
            )
          })}
        </ul>

        {/* Footer: coverage + volume — the honesty line about how thin or
            corroborated this read is. */}
        <p
          className="text-[11px] mt-4 pt-3.5"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            borderTop: '1px solid var(--color-border)',
            lineHeight: 1.5,
          }}
        >
          Blended from {sourceCount} of {maxSources} sources
          {reviewCount != null && reviewCount > 0 && (
            <> across {reviewCount.toLocaleString()} reviews</>
          )}
          , each put on the same 0–10 scale and weighted by how we trust it.
          Awards are shown separately and don&rsquo;t move this number.
        </p>
      </div>
    </section>
  )
}
