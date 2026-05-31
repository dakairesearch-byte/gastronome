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
  /** Per-source contributions, for the methodology tooltip. */
  breakdown: ScoreContribution[]
}

interface ScoreInput {
  google_rating?: number | null
  yelp_rating?: number | null
  infatuation_rating?: number | null
  beli_score?: number | null
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n))

/**
 * Compute the Gastronome Score. Returns null when no rating source is
 * available (caller should fall back to showing nothing rather than a
 * fabricated number).
 */
export function gastronomeScore(r: ScoreInput): GastronomeScore | null {
  const contributions: ScoreContribution[] = []

  if (typeof r.google_rating === 'number') {
    contributions.push({
      source: 'Google',
      native: r.google_rating,
      nativeMax: 5,
      normalized: clamp10(r.google_rating * 2),
      weight: GASTRONOME_SCORE_WEIGHTS.google,
    })
  }
  if (typeof r.yelp_rating === 'number') {
    contributions.push({
      source: 'Yelp',
      native: r.yelp_rating,
      nativeMax: 5,
      normalized: clamp10(r.yelp_rating * 2),
      weight: GASTRONOME_SCORE_WEIGHTS.yelp,
    })
  }
  if (typeof r.infatuation_rating === 'number') {
    contributions.push({
      source: 'The Infatuation',
      native: r.infatuation_rating,
      nativeMax: 10,
      normalized: clamp10(r.infatuation_rating),
      weight: GASTRONOME_SCORE_WEIGHTS.infatuation,
    })
  }
  if (typeof r.beli_score === 'number') {
    contributions.push({
      source: 'Beli',
      native: r.beli_score,
      nativeMax: 10,
      normalized: clamp10(r.beli_score),
      weight: GASTRONOME_SCORE_WEIGHTS.beli,
    })
  }

  if (contributions.length === 0) return null

  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0)
  const weighted =
    contributions.reduce((s, c) => s + c.normalized * c.weight, 0) / totalWeight

  return {
    score: Math.round(clamp10(weighted) * 10) / 10,
    sourceCount: contributions.length,
    breakdown: contributions,
  }
}
