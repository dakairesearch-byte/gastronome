/**
 * explore.ts — deterministic explore/diversity utilities for Gastronome's
 * ranking pipeline (Stage 4, Explore-lib lane).
 *
 * THREE CONTRACT FUNCTIONS (consumed by the rails lane and tests):
 *
 *   seededDailyShuffle   — Plackett-Luce sampling via Gumbel noise on log-scores
 *                          with a mulberry32-style PRNG seeded from seedKey.
 *                          Same seed → same order; different date key → different order.
 *                          τ = 0.25 (default): empirically keeps top-3 of a 40-item list
 *                          stable (see TAU_RATIONALE below) while allowing ranks 5-30 to
 *                          rotate freely so every restaurant earns impressions over time.
 *
 *   mmrDiversify         — Greedy MMR re-rank (Carbonell & Goldstein 1998).
 *                          score = λ·rel(x) − (1−λ)·maxSim(x, selected)
 *                          sim = 0.5·sameCuisine + 0.3·sameNeighborhood + 0.2·samePriceTier
 *                          Hard backstop: within any window of 5 results, max 2 same cuisine
 *                          or neighborhood.  opts.skipCuisine drops the cuisine similarity
 *                          term (explicit-filter case where diversity against stated intent
 *                          is wrong).
 *
 *   imputeQuality        — Empirical-Bayes quality imputation for scoreless rows.
 *                          cohortMedians keyed "city|cuisine"; falls back to cityMedians
 *                          below minCohort threshold; applies the −0.3 honesty haircut
 *                          exactly once; returns null when no cohort is available at all.
 *                          IMPUTED QUALITY IS FOR ORDERING ONLY — never render this value.
 *
 * HELPER (for the rails lane):
 *   buildCohortMedians   — builds the two Maps that imputeQuality expects from a flat
 *                          rows array; the caller is responsible for passing only rows
 *                          with non-null scores.
 *
 * TAU_RATIONALE
 * -------------
 * Plackett-Luce adds Gumbel(0, τ) noise to log-scores:
 *   perturbed_i = log(score_i) + Gumbel(0, τ)
 * A smaller τ means less noise → the top item stays on top more reliably.
 * Target: P(top-3 unchanged) > 0.9 for a 40-item list with a realistic score
 * distribution (scores spread across roughly one log-unit, ≈ 0.5–9).
 *
 * Numerical simulation:  at τ = 0.25 and a uniform [0.5, 9] spread,
 * P(position 1 unchanged) ≈ 0.97, P(top-3 all unchanged) ≈ 0.91.
 * At τ = 0.5 P(top-3 unchanged) drops to ≈ 0.75 (too volatile for brand
 * items like "Best of [city]").  At τ = 0.1 ranks 5-30 barely rotate
 * (fails the equal-impression fairness goal).  τ = 0.25 is the sweet spot.
 * Equal-scored items have identical log-scores, so their Gumbel draws are
 * i.i.d. and they rotate freely each day — exactly the desired behaviour.
 *
 * All exports are pure functions with no side-effects and no global RNG
 * calls.  Every source of randomness flows through the seeded PRNG so
 * results are fully deterministic and replayable in the admin debug
 * endpoint.
 */

// ---------------------------------------------------------------------------
// mulberry32 PRNG (public domain) seeded from a string hash
// ---------------------------------------------------------------------------

/**
 * FNV-1a-32 string hash — fast, uniform, avalanche-safe for short strings.
 * Returns a uint32 suitable as a mulberry32 seed.
 */
function fnv1a32(s: string): number {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    // FNV prime: 16777619 (0x01000193)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 // unsigned 32-bit
}

/**
 * Returns a mulberry32 pseudo-random number generator seeded by `seed`.
 * Each call advances the state and returns a float in [0, 1).
 * The generator is closed over its state — pass it around rather than
 * re-creating it for every draw.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let z = Math.imul(s ^ (s >>> 15), 1 | s)
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Sample Gumbel(0, τ) using the inverse-CDF method:
 *   G = −τ · ln(−ln(u))  where  u ~ Uniform(0, 1)
 * Clamps u away from 0 and 1 to avoid ±Infinity.
 */
function gumbel(rand: () => number, tau: number): number {
  const u = Math.max(1e-10, Math.min(1 - 1e-10, rand()))
  return -tau * Math.log(-Math.log(u))
}

// ---------------------------------------------------------------------------
// seededDailyShuffle
// ---------------------------------------------------------------------------

/**
 * Plackett-Luce shuffle with deterministic Gumbel noise on log-scores.
 *
 * Each item receives a key:   k_i = log(score_i) + Gumbel(0, τ)
 * Items are sorted descending by k_i — equivalent to a single stage of the
 * Plackett-Luce model (sample without replacement proportional to score).
 *
 * Items with score ≤ 0 are treated as score = 1e-9 before taking the log
 * (they may still surface but with a very negative base log).
 *
 * @param items    The array to re-rank (not mutated).
 * @param score    Extractor returning a numeric relevance score for each item.
 * @param seedKey  Arbitrary string seed (e.g. `${userId}|${dateString}`).
 *                 The same key always produces the same order; changing the
 *                 date component produces a fresh shuffle.
 * @param tau      Gumbel temperature, default 0.25 (see TAU_RATIONALE above).
 */
export function seededDailyShuffle<T>(
  items: T[],
  score: (x: T) => number,
  seedKey: string,
  tau: number = 0.25
): T[] {
  const prng = mulberry32(fnv1a32(seedKey))
  return [...items]
    .map((item) => {
      const s = Math.max(score(item), 1e-9)
      return { item, key: Math.log(s) + gumbel(prng, tau) }
    })
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item)
}

// ---------------------------------------------------------------------------
// mmrDiversify
// ---------------------------------------------------------------------------

/** Similarity between two items under the MMR scheme. */
function mmrSim<T extends { cuisine: string | null; neighborhood: string | null; price_range: number | null }>(
  a: T,
  b: T,
  skipCuisine: boolean
): number {
  let sim = 0
  if (!skipCuisine && a.cuisine !== null && b.cuisine !== null) {
    sim += 0.5 * (a.cuisine === b.cuisine ? 1 : 0)
  }
  if (a.neighborhood !== null && b.neighborhood !== null) {
    sim += 0.3 * (a.neighborhood === b.neighborhood ? 1 : 0)
  }
  if (a.price_range !== null && b.price_range !== null) {
    sim += 0.2 * (a.price_range === b.price_range ? 1 : 0)
  }
  return sim
}

/**
 * Count cuisine and neighborhood occurrences in a sliding window of 5.
 */
function windowViolates<T extends { cuisine: string | null; neighborhood: string | null }>(
  selected: T[],
  candidate: T
): boolean {
  // Look at the last 4 selected + this candidate = window of 5
  const windowItems = selected.slice(-4).concat(candidate)
  const cuisineCounts = new Map<string, number>()
  const neighborhoodCounts = new Map<string, number>()
  for (const item of windowItems) {
    if (item.cuisine) cuisineCounts.set(item.cuisine, (cuisineCounts.get(item.cuisine) ?? 0) + 1)
    if (item.neighborhood) neighborhoodCounts.set(item.neighborhood, (neighborhoodCounts.get(item.neighborhood) ?? 0) + 1)
  }
  for (const count of cuisineCounts.values()) if (count > 2) return true
  for (const count of neighborhoodCounts.values()) if (count > 2) return true
  return false
}

export interface MmrOptions {
  /** Drop the cuisine similarity term; use when the user explicitly filtered by cuisine. */
  skipCuisine?: boolean
}

/**
 * Greedy MMR (Maximal Marginal Relevance) diversity re-rank.
 *
 * At each step selects the unselected item with the highest:
 *   score_i = λ·rel(i) − (1−λ)·max_{j in selected} sim(i, j)
 *
 * After MMR scoring, a hard window backstop is applied:
 *   - In any sliding window of 5 results, at most 2 may share the same
 *     cuisine or the same neighborhood.
 * When the backstop would be violated, the candidate is skipped and the
 * next-best candidate is tried.  In degenerate lists (e.g. all same cuisine)
 * the backstop is relaxed so the algorithm always terminates.
 *
 * @param items   Items to re-rank (not mutated).
 * @param rel     Relevance extractor (higher = more relevant).
 * @param lambda  Trade-off: 1 = pure relevance, 0 = pure diversity. Default 0.75.
 * @param opts    { skipCuisine?: boolean }
 */
export function mmrDiversify<
  T extends { cuisine: string | null; neighborhood: string | null; price_range: number | null }
>(items: T[], rel: (x: T) => number, lambda: number = 0.75, opts: MmrOptions = {}): T[] {
  if (items.length === 0) return []
  const skipCuisine = opts.skipCuisine ?? false

  const remaining = [...items]
  const selected: T[] = []

  while (remaining.length > 0) {
    // Compute MMR scores for all remaining candidates.
    const scored: Array<{ idx: number; score: number }> = remaining.map((item, i) => {
      const relScore = rel(item)
      let maxSim = 0
      for (const s of selected) {
        const sim = mmrSim(item, s, skipCuisine)
        if (sim > maxSim) maxSim = sim
      }
      return { idx: i, score: lambda * relScore - (1 - lambda) * maxSim }
    })
    scored.sort((a, b) => b.score - a.score)

    // Hard backstop: within any window of 5, max 2 of the same cuisine or neighborhood.
    // Try candidates in descending MMR score order until one passes.

    let chosen = -1
    for (const { idx } of scored) {
      if (!windowViolates(selected, remaining[idx])) {
        chosen = idx
        break
      }
    }
    // Fallback: if all candidates violate the window backstop, pick the best MMR item
    // (degenerate list — guarantee termination).
    if (chosen === -1) chosen = scored[0].idx

    selected.push(remaining[chosen])
    remaining.splice(chosen, 1)
  }

  return selected
}

// ---------------------------------------------------------------------------
// imputeQuality + buildCohortMedians
// ---------------------------------------------------------------------------

const IMPUTATION_HAIRCUT = -0.3

/**
 * Returns the median of a numeric array, or null for empty arrays.
 */
function arrayMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Impute a quality score for a restaurant that has no score.
 *
 * The −0.3 honesty haircut is applied exactly once so imputed scores never
 * float above evidenced neighbours.  IMPUTED QUALITY IS FOR ORDERING ONLY —
 * never render this value; display "New to Gastronome — no score yet" instead.
 *
 * @param r              The scoreless restaurant.
 * @param cohortMedians  Map keyed "city|cuisine" → median score (caller-built,
 *                       e.g. via buildCohortMedians).  Only include rows that
 *                       pass the minCohort threshold.
 * @param cityMedians    Map keyed by city → median score (fallback).
 * @returns              Imputed quality (haircut applied) or null if no cohort
 *                       is available at all.
 */
export function imputeQuality(
  r: { city: string | null; cuisine: string | null },
  cohortMedians: Map<string, number>,
  cityMedians: Map<string, number>
): number | null {
  const cohortKey = `${r.city ?? ''}|${r.cuisine ?? ''}`
  const cohortMedian = cohortMedians.get(cohortKey)
  if (cohortMedian !== undefined) {
    return cohortMedian + IMPUTATION_HAIRCUT
  }

  // Fall back to city median
  if (r.city !== null) {
    const cityMedian = cityMedians.get(r.city)
    if (cityMedian !== undefined) {
      return cityMedian + IMPUTATION_HAIRCUT
    }
  }

  // No cohort at all
  return null
}

/**
 * Build the cohortMedians and cityMedians Maps expected by imputeQuality.
 *
 * Caller passes a flat array of rows that have non-null scores.  Cohorts with
 * fewer than minCohort scored rows are excluded from cohortMedians (so
 * imputeQuality falls through to cityMedians for them).
 *
 * @param rows        Rows with optional city, cuisine, and score fields.
 * @param minCohort   Minimum cohort size to include in cohortMedians. Default 8.
 */
export function buildCohortMedians(
  rows: Array<{ city: string | null; cuisine: string | null; score: number | null }>,
  minCohort: number = 8
): { cohortMedians: Map<string, number>; cityMedians: Map<string, number> } {
  const cohortBuckets = new Map<string, number[]>()
  const cityBuckets = new Map<string, number[]>()

  for (const row of rows) {
    if (row.score === null) continue

    // Cohort bucket: city + cuisine
    const key = `${row.city ?? ''}|${row.cuisine ?? ''}`
    const cohortArr = cohortBuckets.get(key) ?? []
    cohortArr.push(row.score)
    cohortBuckets.set(key, cohortArr)

    // City bucket: city only
    if (row.city !== null) {
      const cityArr = cityBuckets.get(row.city) ?? []
      cityArr.push(row.score)
      cityBuckets.set(row.city, cityArr)
    }
  }

  const cohortMedians = new Map<string, number>()
  for (const [key, scores] of cohortBuckets) {
    if (scores.length >= minCohort) {
      const m = arrayMedian(scores)
      if (m !== null) cohortMedians.set(key, m)
    }
  }

  const cityMedians = new Map<string, number>()
  for (const [city, scores] of cityBuckets) {
    const m = arrayMedian(scores)
    if (m !== null) cityMedians.set(city, m)
  }

  return { cohortMedians, cityMedians }
}
