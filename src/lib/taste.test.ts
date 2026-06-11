/**
 * taste.test.ts
 *
 * Unit tests for the pure-math core of taste.ts.  No DOM / localStorage
 * required — every tested function accepts plain arrays and returns new arrays.
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  CATALOG_CUISINES,
  buildRestaurantVector,
  dot,
  sigmoid,
  onlineUpdate,
  applySeeds,
  getTasteAffinity,
  recordPositiveEvent,
  seedFromCuisines,
} from './taste'

// ── Dimension / shape ────────────────────────────────────────────────────

describe('buildRestaurantVector', () => {
  it('returns a 22-element array', () => {
    expect(buildRestaurantVector({ cuisine: null, price_range: null, michelin_stars: null })).toHaveLength(22)
  })

  it('sets the correct cuisine one-hot index', () => {
    const v = buildRestaurantVector({ cuisine: 'Italian', price_range: null, michelin_stars: null })
    expect(v[1]).toBe(1)   // Italian is index 1
    // All other indices zero
    expect(v.filter((x) => x !== 0)).toHaveLength(1)
  })

  it('handles an unknown cuisine gracefully — no one-hot set', () => {
    const v = buildRestaurantVector({ cuisine: 'Peruvian', price_range: null, michelin_stars: null })
    expect(v.slice(0, 12).every((x) => x === 0)).toBe(true)
  })

  it('sets the correct price-tier one-hot (price_range 2 → index 13)', () => {
    const v = buildRestaurantVector({ cuisine: null, price_range: 2, michelin_stars: null })
    expect(v[13]).toBe(1)
    expect(v.filter((x) => x !== 0)).toHaveLength(1)
  })

  it('ignores price_range values outside 1..4', () => {
    const v = buildRestaurantVector({ cuisine: null, price_range: 0, michelin_stars: null })
    expect(v.slice(12, 16).every((x) => x === 0)).toBe(true)
  })

  it('sets the accolade flag (index 16) for michelin_stars >= 1', () => {
    const v = buildRestaurantVector({ cuisine: null, price_range: null, michelin_stars: 2 })
    expect(v[16]).toBe(1)
  })

  it('does NOT set the accolade flag for michelin_stars = 0', () => {
    const v = buildRestaurantVector({ cuisine: null, price_range: null, michelin_stars: 0 })
    expect(v[16]).toBe(0)
  })

  it('combines cuisine + price + accolade correctly', () => {
    const v = buildRestaurantVector({ cuisine: 'Japanese', price_range: 3, michelin_stars: 1 })
    expect(v[4]).toBe(1)   // Japanese
    expect(v[14]).toBe(1)  // price_range 3 → offset 12 + 2 = 14
    expect(v[16]).toBe(1)  // accolade
    expect(v.filter((x) => x !== 0)).toHaveLength(3)
  })
})

// ── Dot product ──────────────────────────────────────────────────────────

describe('dot', () => {
  it('returns 0 for orthogonal vectors', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0)
  })

  it('returns the sum of element-wise products', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
  })

  it('handles zero vectors', () => {
    expect(dot([0, 0], [0, 0])).toBe(0)
  })
})

// ── Sigmoid ──────────────────────────────────────────────────────────────

describe('sigmoid', () => {
  it('returns 0.5 at z=0', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10)
  })

  it('approaches 1 for large positive z', () => {
    expect(sigmoid(100)).toBeCloseTo(1, 5)
  })

  it('approaches 0 for large negative z', () => {
    expect(sigmoid(-100)).toBeCloseTo(0, 5)
  })

  it('is symmetric: sigmoid(z) + sigmoid(-z) == 1', () => {
    for (const z of [0.5, 1, 2, 5]) {
      expect(sigmoid(z) + sigmoid(-z)).toBeCloseTo(1, 10)
    }
  })
})

// ── onlineUpdate ─────────────────────────────────────────────────────────

describe('onlineUpdate', () => {
  it('does not mutate the input vector', () => {
    const v = [1, 0, 0]
    const x = [0, 1, 0]
    onlineUpdate(v, x)
    expect(v).toEqual([1, 0, 0])
  })

  it('moves v toward x by eta', () => {
    const v = [0, 0, 0]
    const x = [1, 0, 0]
    const updated = onlineUpdate(v, x, 0.15)
    expect(updated[0]).toBeCloseTo(0.15, 10)
  })

  it('converges to x after many updates from a zero vector', () => {
    let v = new Array<number>(3).fill(0)
    const x = [1, 0.5, 0.2]
    for (let i = 0; i < 200; i++) v = onlineUpdate(v, x, 0.15)
    expect(v[0]).toBeCloseTo(x[0], 2)
    expect(v[1]).toBeCloseTo(x[1], 2)
    expect(v[2]).toBeCloseTo(x[2], 2)
  })
})

// ── applySeeds ───────────────────────────────────────────────────────────

describe('applySeeds', () => {
  it('does not mutate the input vector', () => {
    const v = new Array<number>(22).fill(0)
    applySeeds(v, ['Mexican'])
    expect(v).toEqual(new Array<number>(22).fill(0))
  })

  it('raises the cuisine dimension for a known cuisine', () => {
    const v = new Array<number>(22).fill(0)
    const seeded = applySeeds(v, ['Mexican'], 10)
    // Mexican is index 0
    expect(seeded[0]).toBeGreaterThan(0)
  })

  it('ignores unknown cuisine strings without throwing', () => {
    const v = new Array<number>(22).fill(0)
    expect(() => applySeeds(v, ['Peruvian', 'Ethiopian'])).not.toThrow()
  })

  it('seeds are stronger than a single online update', () => {
    const v = new Array<number>(22).fill(0)
    const seeded = applySeeds(v, ['Italian'], 10)
    const singleUpdate = onlineUpdate(v, (() => {
      const x = new Array<number>(22).fill(0)
      x[1] = 1
      return x
    })(), 0.15)
    // Pseudo-weight 10 should be much larger than a single η=0.15 step
    expect(seeded[1]).toBeGreaterThan(singleUpdate[1])
  })
})

// ── Affinity bounds ──────────────────────────────────────────────────────

describe('getTasteAffinity — SSR / DOM-free path', () => {
  // When called on the server (no window), it returns 1.0 neutral.
  // We can verify the math by using buildRestaurantVector + dot + sigmoid
  // directly without hitting localStorage.

  it('affinity is bounded [0.85, 1.15] for any restaurant vector', () => {
    // Worst-case extremes: all-ones vector vs all-zeros preference
    const { sigmoid: sig, dot: d } = { sigmoid, dot }
    const vectors = [
      new Array<number>(22).fill(0),
      new Array<number>(22).fill(1),
      buildRestaurantVector({ cuisine: 'Korean', price_range: 4, michelin_stars: 3 }),
    ]
    for (const v of vectors) {
      for (const x of vectors) {
        const raw = d(v, x)
        const aff = 0.85 + 0.30 * sig(raw - 0.5)
        expect(aff).toBeGreaterThanOrEqual(0.85 - 1e-10)
        expect(aff).toBeLessThanOrEqual(1.15 + 1e-10)
      }
    }
  })

  it('a neutral zero vector returns affinity close to 0.85 (sigmoid(−0.5)~0.378)', () => {
    const v = new Array<number>(22).fill(0)
    const x = buildRestaurantVector({ cuisine: 'Mexican', price_range: 2, michelin_stars: null })
    const rawDot = dot(v, x)
    const aff = 0.85 + 0.30 * sigmoid(rawDot - 0.5)
    // dot(zero, x) = 0; sigmoid(0 − 0.5) = sigmoid(−0.5) ≈ 0.378
    expect(aff).toBeCloseTo(0.85 + 0.30 * sigmoid(-0.5), 6)
    expect(aff).toBeGreaterThanOrEqual(0.85)
    expect(aff).toBeLessThanOrEqual(1.15)
  })
})

// ── CATALOG_CUISINES coverage ────────────────────────────────────────────

describe('CATALOG_CUISINES', () => {
  it('has exactly 12 entries', () => {
    expect(CATALOG_CUISINES).toHaveLength(12)
  })

  it('round-trips through buildRestaurantVector for every entry', () => {
    for (const cuisine of CATALOG_CUISINES) {
      const v = buildRestaurantVector({ cuisine, price_range: null, michelin_stars: null })
      expect(v.filter((x) => x !== 0)).toHaveLength(1)
    }
  })
})

// ── SSR safety ───────────────────────────────────────────────────────────

describe('SSR safety (no window)', () => {
  // Vitest runs with environment: 'node' (see vitest.config.ts) — there is
  // NO window and NO localStorage here, so these tests exercise the exact
  // code path a Next.js server render takes.

  it('getTasteAffinity returns exactly 1.0 (neutral) on the server', () => {
    const aff = getTasteAffinity({ cuisine: 'Pizza', city: 'NYC', price_range: 2, michelin_stars: null })
    expect(aff).toBe(1.0)
  })

  it('recordPositiveEvent and seedFromCuisines are no-ops that do not throw', () => {
    expect(() => recordPositiveEvent({ cuisine: 'French', city: null, price_range: 3, michelin_stars: 1 })).not.toThrow()
    expect(() => seedFromCuisines(['French', 'Japanese'])).not.toThrow()
  })
})

// ── Client path (stubbed window + localStorage) ──────────────────────────

describe('client path (stubbed window/localStorage)', () => {
  function stubWindow(): Map<string, string> {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })
    return store
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cold start (empty vector) returns exactly 1.0 — matching the SSR neutral, so rails cold-start detection (=== 1.0) works on both sides', () => {
    stubWindow()
    const aff = getTasteAffinity({ cuisine: 'Italian', city: null, price_range: 2, michelin_stars: null })
    expect(aff).toBe(1.0)
  })

  it('after a positive event, a matching restaurant scores higher affinity than a non-matching one; both stay in [0.85, 1.15]', () => {
    stubWindow()
    const italian = { cuisine: 'Italian', city: null, price_range: 2, michelin_stars: null }
    const thai = { cuisine: 'Thai', city: null, price_range: 4, michelin_stars: null }
    recordPositiveEvent(italian)
    const affMatch = getTasteAffinity(italian)
    const affOther = getTasteAffinity(thai)
    expect(affMatch).toBeGreaterThan(affOther)
    for (const aff of [affMatch, affOther]) {
      expect(aff).toBeGreaterThanOrEqual(0.85)
      expect(aff).toBeLessThanOrEqual(1.15)
    }
  })

  it('affinity stays within [0.85, 1.15] even after many repeated positive events (vector saturation)', () => {
    stubWindow()
    const r = { cuisine: 'Korean', city: null, price_range: 4, michelin_stars: 3 }
    for (let i = 0; i < 100; i++) recordPositiveEvent(r)
    const aff = getTasteAffinity(r)
    expect(aff).toBeGreaterThanOrEqual(0.85)
    expect(aff).toBeLessThanOrEqual(1.15)
    // Saturated match should sit in the upper half of the band.
    expect(aff).toBeGreaterThan(1.0)
  })

  it('seedFromCuisines primes affinity toward the seeded cuisine', () => {
    stubWindow()
    seedFromCuisines(['Korean'])
    const affSeeded = getTasteAffinity({ cuisine: 'Korean', city: null, price_range: null, michelin_stars: null })
    const affOther = getTasteAffinity({ cuisine: 'French', city: null, price_range: null, michelin_stars: null })
    expect(affSeeded).toBeGreaterThan(affOther)
  })

  it('persists the vector to localStorage under the versioned key', () => {
    const store = stubWindow()
    recordPositiveEvent({ cuisine: 'Pizza', city: null, price_range: 1, michelin_stars: null })
    expect(store.has('gastronome_taste_v0')).toBe(true)
    const parsed = JSON.parse(store.get('gastronome_taste_v0')!) as { v: number[] }
    expect(parsed.v).toHaveLength(22)
  })

  it('recovers gracefully from corrupted localStorage payloads', () => {
    const store = stubWindow()
    store.set('gastronome_taste_v0', '{not json')
    const aff = getTasteAffinity({ cuisine: 'Cafe', city: null, price_range: 2, michelin_stars: null })
    expect(aff).toBe(1.0) // falls back to the zero vector → cold-start neutral
  })
})
