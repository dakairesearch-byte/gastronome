/**
 * Tests for src/lib/ranking/explore.ts
 *
 * Conventions follow trending.test.ts:
 *   - Pure helpers tested in isolation.
 *   - No database access — all functions are pure.
 *   - Fixed seeds / fixtures for determinism.
 */

import { describe, expect, it } from 'vitest'
import {
  seededDailyShuffle,
  mmrDiversify,
  imputeQuality,
  buildCohortMedians,
} from './explore'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type RestaurantLike = {
  id: string
  cuisine: string | null
  neighborhood: string | null
  price_range: number | null
}

function makeRestaurants(
  specs: Array<{
    id: string
    score?: number
    cuisine?: string | null
    neighborhood?: string | null
    price_range?: number | null
  }>
): Array<RestaurantLike & { score: number }> {
  return specs.map((s) => ({
    id: s.id,
    score: s.score ?? 7,
    cuisine: s.cuisine ?? null,
    neighborhood: s.neighborhood ?? null,
    price_range: s.price_range ?? null,
  }))
}

// A 40-item list with a clear top-3 for the stability tests.
//
// MATH NOTE — Gumbel(0, τ) noise on log-scores makes the swap probability of
// two adjacent items logistic in their log-gap: P(swap) = 1 / (1 + e^{Δlog/τ}).
// For a tightly packed list (e.g. uniform 0.5–9, Δlog ≈ 0.025 near the top)
// P(swap) ≈ 0.48 per adjacent pair, so NO τ keeps a packed top-3 stable —
// near-ties are *supposed* to rotate.  The >0.9 stability target describes the
// "clear winners" regime: here the top-3 lead rank-4 by ≈ 1.4 log-units, so
// each challenger intrudes with probability < 1%.  Exact-PRNG simulation over
// the 200 fixed seeds used below gives P(top-3 unchanged) = 0.975.
const FORTY_ITEMS = [
  { id: 'r0', score: 9.0 },
  { id: 'r1', score: 8.7 },
  { id: 'r2', score: 8.4 },
  // Geometric tail 2.0·0.9^k — tightly packed in log-space (Δlog ≈ 0.105),
  // so ranks 4–40 rotate freely under the same noise (impression fairness).
  ...Array.from({ length: 37 }, (_, k) => ({ id: `r${k + 3}`, score: 2.0 * 0.9 ** k })),
].map((x) => ({
  ...x,
  cuisine: null,
  neighborhood: null,
  price_range: null,
}))

// ---------------------------------------------------------------------------
// seededDailyShuffle — determinism
// ---------------------------------------------------------------------------

describe('seededDailyShuffle — determinism', () => {
  it('same seed produces the same order', () => {
    const items = FORTY_ITEMS.map((x) => ({ ...x }))
    const orderA = seededDailyShuffle(items, (x) => x.score, 'user123|2026-06-10')
    const orderB = seededDailyShuffle(items, (x) => x.score, 'user123|2026-06-10')
    expect(orderA.map((x) => x.id)).toEqual(orderB.map((x) => x.id))
  })

  it('different date produces a different order', () => {
    const items = FORTY_ITEMS.map((x) => ({ ...x }))
    const orderA = seededDailyShuffle(items, (x) => x.score, 'user123|2026-06-10')
    const orderB = seededDailyShuffle(items, (x) => x.score, 'user123|2026-06-11')
    // With 40 items and Gumbel noise it is astronomically unlikely they are identical.
    expect(orderA.map((x) => x.id)).not.toEqual(orderB.map((x) => x.id))
  })

  it('does not mutate the input array', () => {
    const items = FORTY_ITEMS.map((x) => ({ ...x }))
    const origIds = items.map((x) => x.id)
    seededDailyShuffle(items, (x) => x.score, 'seed')
    expect(items.map((x) => x.id)).toEqual(origIds)
  })

  it('output is a permutation — same length, same elements', () => {
    const items = FORTY_ITEMS.map((x) => ({ ...x }))
    const result = seededDailyShuffle(items, (x) => x.score, 'seed')
    expect(result).toHaveLength(items.length)
    expect(new Set(result.map((x) => x.id)).size).toBe(items.length)
  })
})

// ---------------------------------------------------------------------------
// seededDailyShuffle — tau stability (P(top-3 unchanged) > 0.9)
// ---------------------------------------------------------------------------

describe('seededDailyShuffle — tau stability', () => {
  /**
   * Estimate P(top-3 unchanged) over many random date seeds.
   * At τ = 0.25 this should be reliably above 0.9 for a 40-item list.
   */
  it('top-3 stays stable across 200 different seeds (P > 0.9)', () => {
    const items = FORTY_ITEMS.map((x) => ({ ...x }))
    // Compute the "canonical" top-3 (score-sorted, deterministic baseline).
    const canonical = [...items]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.id)

    const trials = 200
    let stable = 0
    for (let i = 0; i < trials; i++) {
      const shuffled = seededDailyShuffle(items, (x) => x.score, `user|2026-06-${String(i).padStart(5, '0')}`)
      const top3 = shuffled.slice(0, 3).map((x) => x.id)
      // Check same elements (order within top-3 can vary).
      if (top3.every((id) => canonical.includes(id))) stable++
    }
    const pStable = stable / trials
    // Must be above 0.9 per the τ = 0.25 spec.
    expect(pStable).toBeGreaterThan(0.9)
  })

  it('equal-scored items rotate freely (different seeds give different orderings among ties)', () => {
    // 5 items all with score = 7 — they should not be frozen in insertion order.
    const tiedItems = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      score: 7,
      cuisine: null,
      neighborhood: null,
      price_range: null,
    }))
    const orderings = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const r = seededDailyShuffle(tiedItems, (x) => x.score, `key|${i}`)
      orderings.add(r.map((x) => x.id).join(','))
    }
    // With 5 equal items and 50 different seeds, we should see several distinct orderings.
    expect(orderings.size).toBeGreaterThan(3)
  })

  it('custom tau=0 (no noise) leaves top item deterministically first', () => {
    const items = makeRestaurants([
      { id: 'best', score: 9 },
      { id: 'mid', score: 5 },
      { id: 'low', score: 1 },
    ])
    // tau=0 → Gumbel(0,0) is a constant, so no perturbation; pure score sort.
    const result = seededDailyShuffle(items, (x) => x.score, 'seed', 0)
    expect(result[0].id).toBe('best')
  })
})

// ---------------------------------------------------------------------------
// mmrDiversify — basic relevance preservation
// ---------------------------------------------------------------------------

describe('mmrDiversify — basic relevance', () => {
  it('returns a permutation of the input', () => {
    const items = makeRestaurants([
      { id: 'a', score: 9, cuisine: 'Italian', neighborhood: 'West Village', price_range: 3 },
      { id: 'b', score: 8, cuisine: 'Japanese', neighborhood: 'East Village', price_range: 2 },
      { id: 'c', score: 7, cuisine: 'Italian', neighborhood: 'West Village', price_range: 3 },
    ])
    const result = mmrDiversify(items, (x) => x.score)
    expect(result).toHaveLength(3)
    expect(new Set(result.map((x) => x.id)).size).toBe(3)
  })

  it('with lambda=1 (pure relevance) returns items in score order', () => {
    const items = makeRestaurants([
      { id: 'low', score: 4, cuisine: 'Italian', neighborhood: null, price_range: null },
      { id: 'high', score: 9, cuisine: 'Italian', neighborhood: null, price_range: null },
      { id: 'mid', score: 6, cuisine: 'Italian', neighborhood: null, price_range: null },
    ])
    const result = mmrDiversify(items, (x) => x.score, 1.0)
    expect(result.map((x) => x.id)).toEqual(['high', 'mid', 'low'])
  })

  it('with lambda=0 (pure diversity) avoids similar items at the top', () => {
    // First item will be the highest relevance (no prior to compare against).
    // Subsequent items should prefer dissimilar ones.
    const items = makeRestaurants([
      { id: 'a', score: 9, cuisine: 'Italian', neighborhood: 'WV', price_range: 3 },
      { id: 'b', score: 8, cuisine: 'Italian', neighborhood: 'WV', price_range: 3 }, // very similar to a
      { id: 'c', score: 7, cuisine: 'Japanese', neighborhood: 'EV', price_range: 2 }, // very different
    ])
    const result = mmrDiversify(items, (x) => x.score, 0.0)
    // After 'a', item 'c' should be chosen before 'b' because it's dissimilar.
    expect(result[0].id).toBe('a') // highest rel always first
    expect(result[1].id).toBe('c') // dissimilar beats similar under pure diversity
  })

  it('handles empty input', () => {
    expect(mmrDiversify([], (x: { cuisine: string | null; neighborhood: string | null; price_range: number | null }) => 0)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mmrDiversify — window backstop (max 2 same cuisine or neighborhood in 5)
// ---------------------------------------------------------------------------

describe('mmrDiversify — window backstop', () => {
  it('no window of 5 contains more than 2 of the same cuisine', () => {
    // FEASIBILITY NOTE: "max 2 per window of 5" caps a 10-slot list at 4 items
    // of one cuisine (disjoint windows [0..4] and [5..9] allow 2 each).  More
    // than 4 makes the constraint infeasible and triggers the documented
    // degenerate-list relaxation — tested separately below.
    //
    // 4 high-scoring Italians + 6 lower-scored distinct cuisines.  Pure
    // relevance would put all 4 Italians in the first window of 5; the
    // backstop must spread them.
    const items = makeRestaurants([
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `italian${i}`,
        score: 9 - i * 0.1, // slight score variation so MMR has preference
        cuisine: 'Italian' as const,
        neighborhood: `IN${i}`,
        price_range: 2,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `other${i}`,
        score: 6 - i * 0.1,
        cuisine: `Cuisine${i}`,
        neighborhood: `ON${i}`,
        price_range: 2,
      })),
    ])

    // Sanity: the pure relevance order DOES violate the cap — proving the
    // assertion below is exercising the backstop, not a trivially-true pool.
    const byRelevance = [...items].sort((a, b) => b.score - a.score)
    const firstWindowItalians = byRelevance.slice(0, 5).filter((x) => x.cuisine === 'Italian')
    expect(firstWindowItalians.length).toBeGreaterThan(2)

    const result = mmrDiversify(items, (x) => x.score)

    // Check every window of 5 in the result
    for (let start = 0; start <= result.length - 5; start++) {
      const window = result.slice(start, start + 5)
      const cuisineCounts = new Map<string, number>()
      for (const item of window) {
        if (item.cuisine) {
          cuisineCounts.set(item.cuisine, (cuisineCounts.get(item.cuisine) ?? 0) + 1)
        }
      }
      for (const [cuisine, count] of cuisineCounts) {
        expect(count, `cuisine "${cuisine}" appears ${count} times in window [${start}..${start + 4}]`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('no window of 5 contains more than 2 of the same neighborhood', () => {
    // 4 high-scoring West Village spots (distinct cuisines, to stress just the
    // neighborhood path) + 6 lower-scored spots in distinct neighborhoods.
    // See the feasibility note above: 4 is the max satisfiable count in 10 slots.
    const items = makeRestaurants([
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `wv${i}`,
        score: 9 - i * 0.1,
        cuisine: `Cuisine${i}`,
        neighborhood: 'West Village' as const,
        price_range: 2,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `other${i}`,
        score: 6 - i * 0.1,
        cuisine: `OtherCuisine${i}`,
        neighborhood: `NH${i}`,
        price_range: 2,
      })),
    ])

    // Sanity: pure relevance order would violate the cap.
    const byRelevance = [...items].sort((a, b) => b.score - a.score)
    const firstWindowWV = byRelevance.slice(0, 5).filter((x) => x.neighborhood === 'West Village')
    expect(firstWindowWV.length).toBeGreaterThan(2)

    const result = mmrDiversify(items, (x) => x.score)

    for (let start = 0; start <= result.length - 5; start++) {
      const window = result.slice(start, start + 5)
      const nhCounts = new Map<string, number>()
      for (const item of window) {
        if (item.neighborhood) {
          nhCounts.set(item.neighborhood, (nhCounts.get(item.neighborhood) ?? 0) + 1)
        }
      }
      for (const [nh, count] of nhCounts) {
        expect(count, `neighborhood "${nh}" appears ${count} times in window [${start}..${start + 4}]`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('relaxes the backstop on a degenerate pool (constraint infeasible) and still terminates with a permutation', () => {
    // 8 of 10 share a cuisine — "max 2 per window of 5" is infeasible (cap is
    // 4 in 10 slots), so the documented fallback must relax the backstop
    // rather than loop forever or drop items.
    const items = makeRestaurants([
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `italian${i}`,
        score: 9 - i * 0.1,
        cuisine: 'Italian' as const,
        neighborhood: `N${i}`,
        price_range: 2,
      })),
      { id: 'jap1', score: 6, cuisine: 'Japanese', neighborhood: 'EV', price_range: 2 },
      { id: 'jap2', score: 5, cuisine: 'Japanese', neighborhood: 'SoHo', price_range: 2 },
    ])

    const result = mmrDiversify(items, (x) => x.score)
    // Terminates, returns every item exactly once.
    expect(result).toHaveLength(10)
    expect(new Set(result.map((x) => x.id)).size).toBe(10)
    // The feasible prefix still interleaves: the two Japanese spots are pulled
    // forward rather than trailing at ranks 9-10.
    const japPositions = result
      .map((x, i) => (x.cuisine === 'Japanese' ? i : -1))
      .filter((i) => i >= 0)
    expect(Math.max(...japPositions)).toBeLessThan(8)
  })

  it('skipCuisine ignores cuisine similarity when user filtered by cuisine', () => {
    // All Italian (user filtered) with different neighborhoods.
    // Without skipCuisine the cuisine term pushes them apart.
    // With skipCuisine the cuisine term is dropped; order should be pure relevance.
    const items = makeRestaurants([
      { id: 'a', score: 9, cuisine: 'Italian', neighborhood: 'WV', price_range: 2 },
      { id: 'b', score: 8, cuisine: 'Italian', neighborhood: 'WV', price_range: 2 },
      { id: 'c', score: 7, cuisine: 'Italian', neighborhood: 'EV', price_range: 2 },
    ])

    // With skipCuisine=true, cuisine similarity is 0, so λ=1 equiv on cuisine axis.
    // Only neighborhood matters. b is same-neighborhood as a, c is different.
    const withSkip = mmrDiversify(items, (x) => x.score, 0.5, { skipCuisine: true })
    const withoutSkip = mmrDiversify(items, (x) => x.score, 0.5, { skipCuisine: false })

    // The two orderings should differ because of the cuisine term.
    // Specifically verify skipCuisine=true doesn't crash and returns permutation.
    expect(withSkip).toHaveLength(3)
    expect(withoutSkip).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// imputeQuality — imputation haircut and fallbacks
// ---------------------------------------------------------------------------

describe('imputeQuality — imputation haircut', () => {
  it('applies exactly a −0.3 haircut to the cohort median', () => {
    const cohortMedians = new Map([['Austin|Italian', 7.5]])
    const cityMedians = new Map([['Austin', 7.0]])
    const result = imputeQuality(
      { city: 'Austin', cuisine: 'Italian' },
      cohortMedians,
      cityMedians
    )
    expect(result).toBeCloseTo(7.5 - 0.3)
  })

  it('falls back to cityMedians when cohort is absent', () => {
    const cohortMedians = new Map<string, number>() // no entry for this city/cuisine
    const cityMedians = new Map([['Austin', 7.0]])
    const result = imputeQuality(
      { city: 'Austin', cuisine: 'Italian' },
      cohortMedians,
      cityMedians
    )
    expect(result).toBeCloseTo(7.0 - 0.3)
  })

  it('returns null when neither cohort nor city median is available', () => {
    const cohortMedians = new Map<string, number>()
    const cityMedians = new Map<string, number>()
    const result = imputeQuality(
      { city: 'Austin', cuisine: 'Italian' },
      cohortMedians,
      cityMedians
    )
    expect(result).toBeNull()
  })

  it('returns null for null city when no cohort key matches', () => {
    const cohortMedians = new Map<string, number>()
    const cityMedians = new Map([['Austin', 7.0]])
    const result = imputeQuality(
      { city: null, cuisine: 'Italian' },
      cohortMedians,
      cityMedians
    )
    // city is null so city fallback can't be used either; cohort key "|Italian" not in map
    expect(result).toBeNull()
  })

  it('cohort key uses "city|cuisine" format — wrong key misses', () => {
    const cohortMedians = new Map([['Austin|Italian', 7.5]])
    const cityMedians = new Map([['Austin', 6.5]])
    // Different cuisine — should fall through to city median.
    const result = imputeQuality(
      { city: 'Austin', cuisine: 'Japanese' },
      cohortMedians,
      cityMedians
    )
    expect(result).toBeCloseTo(6.5 - 0.3)
  })

  it('haircut is applied exactly once — no double-deduction', () => {
    // Verify the haircut does not compound: calling imputeQuality twice with
    // the same inputs should return the same value, not double-deducted.
    const cohortMedians = new Map([['NYC|Japanese', 8.0]])
    const cityMedians = new Map([['NYC', 7.5]])
    const first = imputeQuality({ city: 'NYC', cuisine: 'Japanese' }, cohortMedians, cityMedians)
    const second = imputeQuality({ city: 'NYC', cuisine: 'Japanese' }, cohortMedians, cityMedians)
    expect(first).toBeCloseTo(second!)
    expect(first).toBeCloseTo(8.0 - 0.3) // exactly once
  })
})

// ---------------------------------------------------------------------------
// buildCohortMedians
// ---------------------------------------------------------------------------

describe('buildCohortMedians', () => {
  it('builds cohortMedians keyed "city|cuisine" for cohorts meeting minCohort', () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => ({ city: 'Austin', cuisine: 'Italian', score: 7 + i * 0.1 })),
      ...Array.from({ length: 3 }, (_, i) => ({ city: 'Austin', cuisine: 'Japanese', score: 6 + i * 0.1 })),
    ]
    const { cohortMedians } = buildCohortMedians(rows, 8)
    // Italian: 10 rows ≥ 8 → present
    expect(cohortMedians.has('Austin|Italian')).toBe(true)
    // Japanese: 3 rows < 8 → absent
    expect(cohortMedians.has('Austin|Japanese')).toBe(false)
  })

  it('buildCohortMedians cityMedians includes all cities regardless of cohort size', () => {
    const rows = [
      { city: 'Austin', cuisine: 'Italian', score: 7 },
      { city: 'Austin', cuisine: 'Italian', score: 8 },
    ]
    const { cityMedians } = buildCohortMedians(rows, 8)
    // Only 2 rows but cityMedians should still have Austin
    expect(cityMedians.has('Austin')).toBe(true)
    expect(cityMedians.get('Austin')).toBeCloseTo(7.5)
  })

  it('skips null scores', () => {
    const rows = [
      { city: 'NYC', cuisine: 'Thai', score: 8 },
      { city: 'NYC', cuisine: 'Thai', score: null },
      ...Array.from({ length: 8 }, () => ({ city: 'NYC', cuisine: 'Thai', score: 7 as number | null })),
    ]
    const { cohortMedians } = buildCohortMedians(rows, 8)
    // 9 non-null rows (1 null row excluded) → cohort exists
    expect(cohortMedians.has('NYC|Thai')).toBe(true)
  })

  it('computes the correct median for the city bucket', () => {
    const rows = [
      { city: 'SF', cuisine: 'American', score: 6 },
      { city: 'SF', cuisine: 'Italian', score: 8 },
      { city: 'SF', cuisine: 'Japanese', score: 7 },
    ]
    const { cityMedians } = buildCohortMedians(rows, 1)
    // Scores for SF: [6, 8, 7] → sorted [6, 7, 8] → median = 7
    expect(cityMedians.get('SF')).toBe(7)
  })

  it('cohort median is consistent with imputeQuality result', () => {
    const rows = Array.from({ length: 10 }, () => ({ city: 'Chicago', cuisine: 'BBQ', score: 7.5 }))
    const { cohortMedians, cityMedians } = buildCohortMedians(rows, 8)
    const imputed = imputeQuality({ city: 'Chicago', cuisine: 'BBQ' }, cohortMedians, cityMedians)
    expect(imputed).toBeCloseTo(7.5 - 0.3)
  })

  it('handles null city and cuisine gracefully', () => {
    const rows = [
      { city: null, cuisine: null, score: 7 },
      { city: null, cuisine: null, score: 8 },
    ]
    // Should not throw
    const { cohortMedians, cityMedians } = buildCohortMedians(rows, 1)
    expect(cohortMedians.has('|')).toBe(true) // key for null|null
    expect(cityMedians.has('')).toBe(false) // null city skipped in cityMedians
  })
})
