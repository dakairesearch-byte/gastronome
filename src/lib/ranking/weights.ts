/**
 * Single source of truth for all trending-score weights.
 *
 * Edit this file to tune ranking behavior — no math lives anywhere else in
 * the codebase. See `./trending.ts` for the scoring function that consumes
 * these weights.
 *
 * Weights reflect how much each event "counts" toward a restaurant's score
 * within the time window. Higher weight = more significant signal.
 */

export const WEIGHTS = {
  /** A new row in `restaurant_videos` (any platform). */
  video: 3,
  /** A new row in `reviews`. */
  review: 5,
  /** A new row in `review_photos`. */
  photo: 1,
  // TODO: a new "want to try" / save. No saves table exists yet; when one
  // ships, add `save: 2` here and wire it into trending.ts.
  // TODO: a new editorial-list inclusion. Today editorial-list membership
  // (`eater_38`, `james_beard_*`, `michelin_*`, `accolades`) is static and
  // has no per-event timestamps, so there's nothing to count inside a time
  // window. When those gain `added_at` timestamps, add `listInclusion: 4`
  // here and wire it into trending.ts.
} as const

export type EventKind = keyof typeof WEIGHTS

/**
 * Exponential-decay parameters for the trending formula.
 * Active only when NEXT_PUBLIC_TRENDING_FORMULA=decay (staged rollout flag).
 *
 * Each event contributes:
 *   base_weight * log_cap(1 + n_sameday) * 2^(−Δt_hours / halfLifeHours)
 *
 * where n_sameday = number of events from the same (restaurant, source, day)
 * bucket, and Δt_hours = age of the bucket midpoint in hours.
 *
 * Tuning guide:
 *   videoHalfLifeHours  — lower = sharper recency bias on videos (72h ≈ 3d)
 *   reviewHalfLifeHours — reviews carry intent signal longer (168h = 7d)
 *   photoHalfLifeHours  — same as reviews by default
 *   capBase             — log base for per-day cap (2 → log₂; use 10 to loosen)
 *   decayFloor          — contributions below this fraction are ignored;
 *                         0.001 ≈ 10 half-lives effective lookback
 */
export const DECAY = {
  videoHalfLifeHours: 72,
  reviewHalfLifeHours: 168,
  photoHalfLifeHours: 168,
  capBase: 2,
  decayFloor: 0.001,
} as const

export type Window = '24h' | '7d' | '30d'

export const WINDOW_HOURS: Record<Window, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

export const DEFAULT_WINDOW: Window = '7d'

export const CONSENSUS_WEIGHTS = {
  google: 0.3,
  yelp: 0.3,
  tiktok: 0.2,
  instagram: 0.2,
} as const
