/**
 * Gastronome Score — the unified per-restaurant number the product is named
 * for. A CALIBRATED, ABSOLUTE 0–10 rating: a restaurant's score depends only
 * on its own signals (never on what other restaurants score), and the scale is
 * tuned against the real catalog so the number actually discriminates.
 *
 * WHY THE REWRITE: the previous score just did Google×2 (4.7★ → 9.4, 5.0★ →
 * 10) and averaged Yelp the same way. Curated restaurants cluster at 4.5–5.0★,
 * so ~half the catalog scored ≥9.0 and the top 5% were 9.8–10 — the number had
 * no discrimination and a 10 meant nothing. This version spreads the realistic
 * star band across 0–10 and reserves the top for corroborated, high-volume
 * places.
 *
 * PIPELINE (per-row, client-side, no cohort stats — pure function of the row):
 *  1. Bayesian shrink each source's rating toward a source prior by its review
 *     count, so a 4.9 with 30 reviews regresses to the mean while a 4.7 with
 *     8,000 barely moves. A missing/zero count pulls fully to the prior.
 *  2. Map each shrunk rating through a PERCENTILE-ANCHORED curve (separate
 *     Google/Yelp tables, since equal percentiles should mean equal quality
 *     across their different nominal scales) to a 0–10 per-source quality.
 *  3. Combine present sources as a credibility-weighted average (weights
 *     renormalized over only the sources present, so a missing source is
 *     neutral).
 *  4. EVIDENCE GATES suppress the top: a single uncorroborated source is capped
 *     (the cap rises with its volume, so a 50k-review institution isn't
 *     unfairly crushed), and the elite tip (>9.2) is damped by total review
 *     volume. A 10.0 is effectively unreachable — it needs near-perfect,
 *     high-volume, multi-source corroboration that real data doesn't produce.
 *
 * Accolades (Michelin/JBF/Eater) are deliberately NOT folded into the number —
 * they're shown as separate badges so "why is it 8.4?" always has a clean,
 * rating-derived answer. All calibration constants below are derived from the
 * live catalog distribution (n≈2,125): Google median 4.50 (p90 4.80, p99 5.00),
 * Yelp median 4.20; Google review median ~705 (p99 ~11k); Infatuation is empty
 * and Beli near-empty in current data, so the math leans on Google + Yelp.
 *
 * Display-only; does NOT touch the trending-rank algorithm in src/lib/ranking/.
 */

export const GASTRONOME_SCORE_WEIGHTS = {
  infatuation: 0.45, // editorial / critic voice (column empty in current data)
  google: 0.62, // broad consensus, high volume — the primary signal
  yelp: 0.38, // broad consensus, noisier
  beli: 0.2, // curated social, near-zero coverage
} as const

/**
 * The full universe of rating sources the score *can* draw on. Used by the
 * trust reframe ("N of 4 sources") so coverage is communicated honestly.
 */
export const GASTRONOME_SCORE_MAX_SOURCES =
  Object.keys(GASTRONOME_SCORE_WEIGHTS).length

/* ------------------------------------------------------------------ */
/*  Calibration constants (derived from the real catalog distribution) */
/* ------------------------------------------------------------------ */

// Bayesian shrink: prior mean each source regresses toward, and the pseudo-count
// (M) that sets how much volume it takes to overcome the prior.
const SHRINK = {
  google: { prior: 4.5, m: 650 },
  yelp: { prior: 4.1, m: 350 },
} as const

// Percentile-anchored rating→quality curves (native star → 0–10 quality).
// Anchors encode where a rating sits in the KNOWN real distribution, so the
// compressed 4.x band is spread across the scale. Separate per source because
// Yelp runs ~0.3★ lower than Google for the same quality.
const GOOGLE_ANCHORS: [number, number][] = [
  [3.0, 0.5], [3.5, 2.6], [4.0, 5.2], [4.3, 7.0], [4.5, 7.9],
  [4.6, 8.6], [4.7, 9.2], [4.8, 9.6], [4.9, 9.9], [5.0, 10.0],
]
const YELP_ANCHORS: [number, number][] = [
  [2.5, 0.5], [3.0, 2.6], [3.5, 4.7], [4.0, 6.9], [4.2, 7.9],
  [4.4, 8.8], [4.6, 9.4], [4.7, 9.7], [4.85, 9.9], [5.0, 10.0],
]

// Evidence gates.
const SINGLE_SOURCE_CAP = { base: 8.5, span: 0.5, ref: 15000, ceiling: 9.0 }
const TOPBAND = { knee: 9.2, floorConf: 0.55, spanConf: 0.45, volMin: 100, volFull: 12000 }
const DUAL_SOURCE_CEILING = 9.95 // corroborated places top out just under 10

export interface ScoreContribution {
  /** Display label, e.g. "Google". */
  source: string
  /** The source's rating on its native scale (for the tooltip). */
  native: number
  /** Native scale max (5 or 10). */
  nativeMax: 5 | 10
  /** Bayesian-shrunk native rating (regressed toward the source prior). */
  shrunk: number
  /** Normalized 0–10 per-source quality (post percentile-curve). */
  normalized: number
  /** Weight applied (pre-renormalization). */
  weight: number
}

export interface GastronomeScore {
  /** 0–10, rounded to one decimal. */
  score: number
  /** How many sources fed the score. */
  sourceCount: number
  /** The full universe of sources the score can draw on. */
  maxSources: number
  /**
   * Total underlying review volume (Google + Yelp counts) backing the score,
   * when available. Null when no source reports a count.
   */
  reviewCount: number | null
  /** Display labels of the sources that actually contributed. */
  contributingSources: string[]
  /** Per-source contributions, for the methodology tooltip. */
  breakdown: ScoreContribution[]
}

interface ScoreInput {
  google_rating?: number | null
  yelp_rating?: number | null
  infatuation_rating?: number | null
  beli_score?: number | null
  /** Optional review-volume anchors (used by the Bayesian shrink + gates). */
  google_review_count?: number | null
  yelp_review_count?: number | null
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n))
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Bayesian average: pull a rating toward `prior` by its review count. */
function shrink(rating: number, count: number | null | undefined, prior: number, m: number): number {
  const c = Number.isFinite(count) && (count as number) > 0 ? (count as number) : 0
  return (prior * m + rating * c) / (m + c)
}

/**
 * Piecewise-linear interpolation over sorted [x, y] anchors. Below the lowest
 * knot, extrapolate linearly toward the origin (0, 0); above the highest knot,
 * clamp to that knot's y (the curves top out at 10).
 */
function piecewise(x: number, anchors: [number, number][]): number {
  const [x0, y0] = anchors[0]
  if (x <= x0) return clamp10((x / x0) * y0) // toward (0,0)
  const last = anchors[anchors.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < anchors.length; i++) {
    const [xa, ya] = anchors[i - 1]
    const [xb, yb] = anchors[i]
    if (x <= xb) return ya + ((x - xa) / (xb - xa)) * (yb - ya)
  }
  return last[1]
}

/**
 * Compute the Gastronome Score. Returns null when no rating source is
 * available (caller should show nothing rather than a fabricated number).
 */
export function gastronomeScore(r: ScoreInput): GastronomeScore | null {
  const contributions: ScoreContribution[] = []

  if (Number.isFinite(r.google_rating)) {
    const shrunk = shrink(r.google_rating!, r.google_review_count, SHRINK.google.prior, SHRINK.google.m)
    contributions.push({
      source: 'Google',
      native: r.google_rating!,
      nativeMax: 5,
      shrunk,
      normalized: piecewise(shrunk, GOOGLE_ANCHORS),
      weight: GASTRONOME_SCORE_WEIGHTS.google,
    })
  }
  if (Number.isFinite(r.yelp_rating)) {
    const shrunk = shrink(r.yelp_rating!, r.yelp_review_count, SHRINK.yelp.prior, SHRINK.yelp.m)
    contributions.push({
      source: 'Yelp',
      native: r.yelp_rating!,
      nativeMax: 5,
      shrunk,
      normalized: piecewise(shrunk, YELP_ANCHORS),
      weight: GASTRONOME_SCORE_WEIGHTS.yelp,
    })
  }
  if (Number.isFinite(r.infatuation_rating)) {
    // Critic /10 score, no volume to shrink on — used as-is (rare in data).
    contributions.push({
      source: 'The Infatuation',
      native: r.infatuation_rating!,
      nativeMax: 10,
      shrunk: r.infatuation_rating!,
      normalized: clamp10(r.infatuation_rating!),
      weight: GASTRONOME_SCORE_WEIGHTS.infatuation,
    })
  }
  if (Number.isFinite(r.beli_score)) {
    // Curated social /10 — light shrink toward a high prior (near-zero data).
    const shrunk = shrink(r.beli_score!, 30, 7.5, 12)
    contributions.push({
      source: 'Beli',
      native: r.beli_score!,
      nativeMax: 10,
      shrunk,
      normalized: clamp10(shrunk),
      weight: GASTRONOME_SCORE_WEIGHTS.beli,
    })
  }

  if (contributions.length === 0) return null

  // Credibility-weighted average over only the sources present.
  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0)
  let q = contributions.reduce((s, c) => s + c.normalized * c.weight, 0) / totalWeight

  // Review-volume anchors actually present (Google + Yelp). Null when none.
  const counts = [r.google_review_count, r.yelp_review_count].filter(
    (n): n is number => Number.isFinite(n) && (n as number) >= 0,
  )
  const reviewCount = counts.length ? counts.reduce((s, n) => s + n, 0) : null
  const totalReviews = reviewCount ?? 0

  // EVIDENCE GATES ---------------------------------------------------------
  // (a) Elite-tip damping: above the knee, scale the excess by review-volume
  //     confidence, so only high-volume places keep the very top.
  if (q > TOPBAND.knee) {
    const conf = clamp01(
      TOPBAND.floorConf +
        TOPBAND.spanConf *
          ((Math.log10(Math.max(totalReviews, 1)) - Math.log10(TOPBAND.volMin)) /
            (Math.log10(TOPBAND.volFull) - Math.log10(TOPBAND.volMin))),
    )
    q = TOPBAND.knee + (q - TOPBAND.knee) * conf
  }

  // (b) Corroboration ceiling. A lone source is capped (the cap rises with its
  //     volume so huge single-source institutions aren't crushed); two or more
  //     corroborating sources may reach just under 10.
  const singleSourceCap = Math.min(
    SINGLE_SOURCE_CAP.ceiling,
    SINGLE_SOURCE_CAP.base +
      SINGLE_SOURCE_CAP.span *
        (Math.log10(1 + totalReviews) / Math.log10(1 + SINGLE_SOURCE_CAP.ref)),
  )
  const ceiling = contributions.length >= 2 ? DUAL_SOURCE_CEILING : singleSourceCap
  q = Math.min(q, ceiling)

  return {
    score: Math.round(clamp10(q) * 10) / 10,
    sourceCount: contributions.length,
    maxSources: GASTRONOME_SCORE_MAX_SOURCES,
    reviewCount,
    contributingSources: contributions.map((c) => c.source),
    breakdown: contributions,
  }
}
