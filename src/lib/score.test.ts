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

  it('clamps out-of-range inputs into 0–10', () => {
    // A bad 6.0 Google rating would normalize to 12; clamp to 10.
    const result = gastronomeScore({ google_rating: 6.0 })
    expect(result!.score).toBe(10)
  })
})
