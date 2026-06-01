/**
 * Gastronome Score — the unified per-restaurant number the product is
 * named for. Previously the "headline" rating was just Google's number
 * relabeled, so the aggregation the product promises never actually
 * appeared. This computes a single 0–10 score from whatever rating
 * sources exist.
 *
 * Design (deliberately transparent so it's defensible to a skeptic):
 *  - Each source is normalized to a 0–10 scale (Google/Yelp ×2 from
 *    their native /5; Infatuation/Beli are already /10).
 *  - Sources are combined as a credibility-weighted average, with
 *    weights renormalized over ONLY the sources present — so a missing
 *    source neither helps nor penalizes.
 *  - Accolades (Michelin/JBF/Eater) are intentionally NOT folded in;
 *    they're shown as separate badges. The number stays purely
 *    rating-derived so "why is it 8.4?" always has a clean answer.
 *
 * This is display-only and does NOT touch the trending-rank algorithm
 * in src/lib/ranking/.
 */

export const GASTRONOME_SCORE_WEIGHTS = {
  infatuation: 0.3, // editorial / critic voice
  google: 0.3, // broad consensus, high volume
  yelp: 0.2, // broad consensus, noisier
  beli: 0.2, // curated social
} as const

/**
 * The full universe of rating sources the score *can* draw on. Used by
 * the trust reframe ("N of 4 sources") so coverage is communicated
 * honestly — a restaurant scored from one source shouldn't read as
 * authoritative as one corroborated by all four.
 */
export const GASTRONOME_SCORE_MAX_SOURCES =
  Object.keys(GASTRONOME_SCORE_WEIGHTS).length

export interface ScoreContribution {
  /** Display label, e.g. "Google". */
  source: string
  /** The source's rating on its native scale (for the tooltip). */
  native: number
  /** Native scale max (5 or 10). */
  nativeMax: 5 | 10
  /** Normalized to 0–10. */
  normalized: number
  /** Weight applied (pre-renormalization). */
  weight: number
}

export interface GastronomeScore {
  /** 0–10, rounded to one decimal. */
  score: number
  /** How many sources fed the score. */
  sourceCount: number
  /**
   * The full universe of sources the score can draw on, so the UI can
   * honestly say "N of {maxSources} sources" rather than implying the
   * number is corroborated by more sources than it actually is.
   */
  maxSources: number
  /**
   * Total underlying review volume (Google + Yelp counts) backing the
   * score, when available. A review-count anchor keeps an 8.5 from one
   * 12-review source from reading the same as one from 4,000 reviews.
   * Null when no source reports a count.
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
  /** Optional review-volume anchors (additive; not required by callers). */
  google_review_count?: number | null
  yelp_review_count?: number | null
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n))

/**
 * Compute the Gastronome Score. Returns null when no rating source is
 * available (caller should fall back to showing nothing rather than a
 * fabricated number).
 */
export function gastronomeScore(r: ScoreInput): GastronomeScore | null {
  const contributions: ScoreContribution[] = []

  if (Number.isFinite(r.google_rating)) {
    contributions.push({
      source: 'Google',
      native: r.google_rating!,
      nativeMax: 5,
      normalized: clamp10(r.google_rating! * 2),
      weight: GASTRONOME_SCORE_WEIGHTS.google,
    })
  }
  if (Number.isFinite(r.yelp_rating)) {
    contributions.push({
      source: 'Yelp',
      native: r.yelp_rating!,
      nativeMax: 5,
      normalized: clamp10(r.yelp_rating! * 2),
      weight: GASTRONOME_SCORE_WEIGHTS.yelp,
    })
  }
  if (Number.isFinite(r.infatuation_rating)) {
    contributions.push({
      source: 'The Infatuation',
      native: r.infatuation_rating!,
      nativeMax: 10,
      normalized: clamp10(r.infatuation_rating!),
      weight: GASTRONOME_SCORE_WEIGHTS.infatuation,
    })
  }
  if (Number.isFinite(r.beli_score)) {
    contributions.push({
      source: 'Beli',
      native: r.beli_score!,
      nativeMax: 10,
      normalized: clamp10(r.beli_score!),
      weight: GASTRONOME_SCORE_WEIGHTS.beli,
    })
  }

  if (contributions.length === 0) return null

  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0)
  const weighted =
    contributions.reduce((s, c) => s + c.normalized * c.weight, 0) / totalWeight

  // Sum the review-volume anchors that are actually present. Kept null
  // (not 0) when neither source reports a count, so the UI can hide the
  // anchor rather than claim "0 reviews".
  const counts = [r.google_review_count, r.yelp_review_count].filter(
    (n): n is number => Number.isFinite(n) && (n as number) >= 0,
  )
  const reviewCount = counts.length
    ? counts.reduce((s, n) => s + n, 0)
    : null

  return {
    score: Math.round(clamp10(weighted) * 10) / 10,
    sourceCount: contributions.length,
    maxSources: GASTRONOME_SCORE_MAX_SOURCES,
    reviewCount,
    contributingSources: contributions.map((c) => c.source),
    breakdown: contributions,
  }
}
