import { describe, it, expect } from 'vitest'
import { gastronomeScore } from './score'

describe('gastronomeScore', () => {
  it('returns null when no rating source is present', () => {
    expect(gastronomeScore({})).toBeNull()
    expect(
      gastronomeScore({
        google_rating: null,
        yelp_rating: null,
        infatuation_rating: null,
        beli_score: null,
      })
    ).toBeNull()
  })

  it('normalizes a single Google rating to /10', () => {
    // 4.3 / 5 → ×2 = 8.6; sole source so weight renormalizes to 1.
    const result = gastronomeScore({ google_rating: 4.3 })
    expect(result).not.toBeNull()
    expect(result!.score).toBe(8.6)
    expect(result!.sourceCount).toBe(1)
  })

  it('renormalizes weights over only the present sources', () => {
    // Google 4.5→9.0 (w .3), Yelp 4.0→8.0 (w .2). Missing Infatuation
    // and Beli must NOT drag the score down.
    // weighted = (9.0*.3 + 8.0*.2) / (.3 + .2) = (2.7 + 1.6) / .5 = 8.6
    const result = gastronomeScore({ google_rating: 4.5, yelp_rating: 4.0 })
    expect(result!.score).toBe(8.6)
    expect(result!.sourceCount).toBe(2)
  })

  it('blends all four sources with credibility weights', () => {
    // Google 4.0→8.0 (.3), Yelp 3.5→7.0 (.2), Infatuation 9.0 (.3), Beli 8.0 (.2)
    // = 8.0*.3 + 7.0*.2 + 9.0*.3 + 8.0*.2 = 2.4 + 1.4 + 2.7 + 1.6 = 8.1 / 1.0
    const result = gastronomeScore({
      google_rating: 4.0,
      yelp_rating: 3.5,
      infatuation_rating: 9.0,
      beli_score: 8.0,
    })
    expect(result!.score).toBe(8.1)
    expect(result!.sourceCount).toBe(4)
  })

  it('rejects NaN and Infinity inputs (treated as absent)', () => {
    // NaN / ±Infinity must not produce a NaN score or a fabricated source.
    expect(gastronomeScore({ google_rating: NaN })).toBeNull()
    expect(gastronomeScore({ yelp_rating: Infinity })).toBeNull()
    expect(gastronomeScore({ infatuation_rating: -Infinity })).toBeNull()
    expect(gastronomeScore({ beli_score: NaN })).toBeNull()

    // A bad source must not contaminate a good one: NaN Google is dropped,
    // Yelp 4.0→8.0 stands alone (weight renormalizes to 1).
    const mixed = gastronomeScore({ google_rating: NaN, yelp_rating: 4.0 })
    expect(mixed).not.toBeNull()
    expect(mixed!.sourceCount).toBe(1)
    expect(mixed!.score).toBe(8.0)
    expect(Number.isFinite(mixed!.score)).toBe(true)
  })

  it('accepts a zero rating as a real (finite) source', () => {
    // 0 is a legitimate value, not "missing" — it should count.
    const result = gastronomeScore({ google_rating: 0 })
    expect(result).not.toBeNull()
    expect(result!.sourceCount).toBe(1)
    expect(result!.score).toBe(0)
  })

  it('clamps out-of-range inputs into 0–10', () => {
    // A bad 6.0 Google rating would normalize to 12; clamp to 10.
    const result = gastronomeScore({ google_rating: 6.0 })
    expect(result!.score).toBe(10)
  })
})
