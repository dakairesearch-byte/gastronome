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

export type Window = '24h' | '7d' | '30d'

export const WINDOW_HOURS: Record<Window, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

export const DEFAULT_WINDOW: Window = '7d'
