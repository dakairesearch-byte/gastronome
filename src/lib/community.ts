/**
 * community.ts — pure display-gate helpers for the Community scoring layer.
 *
 * All functions are pure (no I/O, no imports from src/lib/score.ts) so they
 * are trivially unit-testable and import-safe in both server and client code.
 *
 * Reference: §2 of ENGAGEMENT_AND_COMMUNITY_SCORING_2026-06-09.md
 *   - shouldShowCommunityScore: weighted_n ≥ 5 AND n_ratings ≥ 3
 *   - shouldShowReturnRate:     n_return_asked ≥ 5
 *   - fuzzyBand:                suppress exact counts to hide gaming thresholds
 *   - formatReturnRate:         "93% · 41 diners" style
 *   - confidenceDots:           1-3 dots from ci_halfwidth
 */

/** Minimal shape of a restaurant_community_stats row needed for display gating. */
export interface CommunityStats {
  n_been:          number
  n_return_asked:  number
  n_return_yes:    number
  n_ratings:       number
  weighted_n:      number
  mean_raw:        number | null
  mean_calibrated: number | null
  ci_halfwidth:    number | null
  elo:             number
  n_comparisons:   number
  computed_at:     string | null
}

// ─── Display gates ────────────────────────────────────────────────────────────

/**
 * Should the calibrated community score be shown at all?
 * Gate: weighted_n ≥ 5 AND n_ratings ≥ 3.
 *
 * Five Tier-0 sybils (Σw = 0.25) show nothing.
 * Five verified locals (Σw ≥ 5) publish.
 */
export function shouldShowCommunityScore(stats: CommunityStats): boolean {
  return stats.weighted_n >= 5 && stats.n_ratings >= 3
}

/**
 * Should the "% would return" headline stat be shown?
 * Gate: n_return_asked ≥ 5 (one grumpy verdict must never render as "0%").
 */
export function shouldShowReturnRate(stats: CommunityStats): boolean {
  return stats.n_return_asked >= 5
}

/**
 * Should the Crowd Rank (Elo ladder position) be shown?
 * Gate: n_comparisons ≥ 10 (per §2: "hidden below 10 comparisons").
 */
export function shouldShowCrowdRank(stats: CommunityStats): boolean {
  return stats.n_comparisons >= 10
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Fuzzy-band a raw count so the exact gaming threshold and per-vote deltas
 * stay invisible to observers.
 *
 * Bands: <5 → exact, 5-9 → "5+", 10-19 → "10+", 20-49 → "20+",
 *        50-99 → "50+", 100-199 → "100+", 200-499 → "200+", 500+ → "500+"
 *
 * @example fuzzyBand(23) === "20+"
 * @example fuzzyBand(3)  === "3"
 */
export function fuzzyBand(n: number): string {
  if (n < 5)   return String(n)
  if (n < 10)  return '5+'
  if (n < 20)  return '10+'
  if (n < 50)  return '20+'
  if (n < 100) return '50+'
  if (n < 200) return '100+'
  if (n < 500) return '200+'
  return '500+'
}

/**
 * Format the "would return" rate for display.
 * Returns null when the gate is not met (callers should check shouldShowReturnRate first,
 * but this also guards internally).
 *
 * Counts are fuzzy-banded per §2, so n=41 renders as "20+".
 *
 * @example formatReturnRate(stats) === "93% · 20+ diners"
 */
export function formatReturnRate(stats: CommunityStats): string | null {
  if (!shouldShowReturnRate(stats)) return null
  const pct = Math.round((stats.n_return_yes / stats.n_return_asked) * 100)
  return `${pct}% · ${fuzzyBand(stats.n_return_asked)} diners`
}

/**
 * Confidence dots (1-3) from ci_halfwidth.
 *
 * The wider the CI, the fewer dots (less confidence).
 *   ci < 0.3   → 3 dots (high confidence)
 *   ci < 0.6   → 2 dots
 *   ci < 1.5   → 1 dot
 *   ci ≥ 1.5   → 0 dots (should not display the number at all, but callers decide)
 *
 * Returns 0 when ci_halfwidth is null/absent.
 */
export function confidenceDots(stats: CommunityStats): 0 | 1 | 2 | 3 {
  const ci = stats.ci_halfwidth
  if (ci == null) return 0
  if (ci < 0.3)  return 3
  if (ci < 0.6)  return 2
  if (ci < 1.5)  return 1
  return 0
}

/**
 * Format the calibrated community score for display.
 * Returns null when the gate is not met.
 *
 * @example formatCommunityScore(stats) === "7.4"
 */
export function formatCommunityScore(stats: CommunityStats): string | null {
  if (!shouldShowCommunityScore(stats)) return null
  if (stats.mean_calibrated == null) return null
  return stats.mean_calibrated.toFixed(1)
}

/**
 * Returns a short "Community N · XX+" label for cards (e.g. "Community 7.4 · 20+ ratings").
 * Returns null when display gate is not met.
 */
export function communityScoreLabel(stats: CommunityStats): string | null {
  const score = formatCommunityScore(stats)
  if (!score) return null
  return `Community ${score} · ${fuzzyBand(stats.n_ratings)} ratings`
}
