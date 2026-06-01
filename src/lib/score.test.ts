import { describe, it, expect } from 'vitest'
import { gastronomeScore } from './score'

describe('gastronomeScore (calibrated absolute)', () => {
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

  it('rejects NaN and Infinity inputs (treated as absent)', () => {
    expect(gastronomeScore({ google_rating: NaN })).toBeNull()
    expect(gastronomeScore({ yelp_rating: Infinity })).toBeNull()
    expect(gastronomeScore({ infatuation_rating: -Infinity })).toBeNull()
    expect(gastronomeScore({ beli_score: NaN })).toBeNull()

    // A bad source must not contaminate a good one.
    const mixed = gastronomeScore({ google_rating: NaN, yelp_rating: 4.5, yelp_review_count: 2000 })
    expect(mixed).not.toBeNull()
    expect(mixed!.sourceCount).toBe(1)
    expect(Number.isFinite(mixed!.score)).toBe(true)
  })

  it('reports source coverage + review volume honestly', () => {
    const r = gastronomeScore({
      google_rating: 4.6,
      google_review_count: 1200,
      yelp_rating: 4.4,
      yelp_review_count: 800,
    })!
    expect(r.sourceCount).toBe(2)
    expect(r.maxSources).toBe(4)
    expect(r.contributingSources).toEqual(['Google', 'Yelp'])
    expect(r.reviewCount).toBe(2000)
  })

  // ---- Calibration: the realistic 4.x band is spread across the scale ----

  it('puts a median (4.5★) restaurant in the mid-7s, not the 9s', () => {
    // Old formula gave 4.5 → 9.0. Calibrated curve maps the p50 rating to ~7.9.
    const r = gastronomeScore({ google_rating: 4.5, google_review_count: 705 })!
    expect(r.score).toBe(7.9)
  })

  it('scores a mediocre 4.0★ place in the mid-range, well below the top', () => {
    const r = gastronomeScore({ google_rating: 4.0, google_review_count: 1000 })!
    expect(r.score).toBeGreaterThan(5.5)
    expect(r.score).toBeLessThan(7)
  })

  // ---- Bayesian volume shrinkage ----

  it('rewards corroborating review volume for an above-prior rating', () => {
    const lowVol = gastronomeScore({ google_rating: 4.8, google_review_count: 100 })!
    const highVol = gastronomeScore({ google_rating: 4.8, google_review_count: 10000 })!
    expect(highVol.score).toBeGreaterThan(lowVol.score)
  })

  it('pulls a high rating with almost no reviews toward the prior', () => {
    // 5.0 with 20 reviews is not trustworthy — it must not beat a
    // well-corroborated 4.7 with thousands of reviews.
    const thin = gastronomeScore({ google_rating: 5.0, google_review_count: 20 })!
    const solid = gastronomeScore({
      google_rating: 4.7,
      google_review_count: 4000,
      yelp_rating: 4.6,
      yelp_review_count: 3000,
    })!
    expect(thin.score).toBeLessThan(solid.score)
  })

  it('treats a missing/zero review count as no evidence (shrinks to prior)', () => {
    // A lone 5.0 with no volume info must NOT read as a perfect score.
    const r = gastronomeScore({ google_rating: 5.0 })!
    expect(r.score).toBeLessThan(8.5)
  })

  // ---- Rarity: a 10 is near-unattainable; the top is earned ----

  it('caps a single uncorroborated source out of the elite band', () => {
    // Even a perfect 5.0 with huge volume, from ONE source, tops out at ~8.5 —
    // the top tier is reserved for restaurants multiple crowds corroborate.
    const r = gastronomeScore({ google_rating: 5.0, google_review_count: 25000 })!
    expect(r.score).toBeLessThanOrEqual(8.5)
    expect(r.score).toBeGreaterThanOrEqual(8.0)
  })

  it('penalizes cross-source disagreement — consensus beats a populist split', () => {
    // A populist split (Google 4.9, Yelp 4.4) must score BELOW a place both
    // crowds agree on (Google 4.7, Yelp 4.7), even though the split has the
    // higher raw Google rating. This is the Cvi.che 105 case.
    const split = gastronomeScore({
      google_rating: 4.9, google_review_count: 30000,
      yelp_rating: 4.4, yelp_review_count: 6000,
    })!
    const agree = gastronomeScore({
      google_rating: 4.7, google_review_count: 30000,
      yelp_rating: 4.7, yelp_review_count: 6000,
    })!
    expect(agree.score).toBeGreaterThan(split.score)
  })

  it('lets a strongly corroborated destination reach the low 9s — not 10', () => {
    // Alain Ducasse-shaped input: g4.8/8788 + y4.5/4461 → ~9.3 (matches the
    // validated full-catalog run). High, elite, but short of a 10.
    const r = gastronomeScore({
      google_rating: 4.8,
      google_review_count: 8788,
      yelp_rating: 4.5,
      yelp_review_count: 4461,
    })!
    expect(r.score).toBeGreaterThanOrEqual(9.0)
    expect(r.score).toBeLessThanOrEqual(9.5)
  })

  it('keeps 10.0 out of reach for any realistic restaurant', () => {
    // The strongest plausible real input still lands under 10.
    const best = gastronomeScore({
      google_rating: 4.9,
      google_review_count: 12000,
      yelp_rating: 4.8,
      yelp_review_count: 6000,
    })!
    expect(best.score).toBeLessThan(10)
  })

  it('applies social buzz ONLY when the ratings are already strong (consensus-gated)', () => {
    const base = {
      google_rating: 4.8, google_review_count: 8788,
      yelp_rating: 4.5, yelp_review_count: 4461,
    }
    const noSocial = gastronomeScore(base)!
    const withSocial = gastronomeScore({ ...base, social_score: 1 })!
    // A strong, corroborated place that's also blowing up gets a real lift.
    expect(withSocial.score).toBeGreaterThan(noSocial.score)
    expect(withSocial.socialBoost).toBeGreaterThan(0)
  })

  it('gives a viral-but-mediocre restaurant no social lift', () => {
    const dudNoSocial = gastronomeScore({ google_rating: 4.0, google_review_count: 1000 })!
    const dudViral = gastronomeScore({
      google_rating: 4.0, google_review_count: 1000, social_score: 1,
    })!
    // Mediocre ratings → the gate is closed → virality buys nothing.
    expect(dudViral.score).toBe(dudNoSocial.score)
    expect(dudViral.socialBoost).toBe(0)
  })

  it('is monotonic in rating at fixed volume', () => {
    const vol = { google_review_count: 2000 }
    const a = gastronomeScore({ google_rating: 4.2, ...vol })!.score
    const b = gastronomeScore({ google_rating: 4.5, ...vol })!.score
    const c = gastronomeScore({ google_rating: 4.8, ...vol })!.score
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
  })

  it('always returns a finite score in [0, 10] rounded to one decimal', () => {
    for (const g of [0, 2.5, 3.7, 4.4, 4.9, 5.0]) {
      const r = gastronomeScore({ google_rating: g, google_review_count: 500 })!
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(10)
      expect(Math.round(r.score * 10) / 10).toBe(r.score)
    }
  })
})
