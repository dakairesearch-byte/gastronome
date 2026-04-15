import { describe, expect, it } from 'vitest'
import {
  cutoffForWindow,
  computeScoresFromData,
  median,
  rankScores,
  weightedSum,
  type RawData,
} from './trending'
import { WEIGHTS } from './weights'

// ---------- helpers ----------

function rawData(
  restaurants: Array<{ id: string; city: string | null; cuisine?: string | null }>,
  events: {
    videos?: Array<{ restaurant_id: string }>
    reviews?: Array<{ restaurant_id: string }>
    photos?: Array<{ restaurant_id: string }>
  } = {}
): RawData {
  return {
    restaurants: restaurants.map((r) => ({
      id: r.id,
      city: r.city,
      cuisine: r.cuisine ?? null,
    })),
    videoEvents: events.videos ?? [],
    reviewEvents: events.reviews ?? [],
    photoEvents: events.photos ?? [],
  }
}

function nVideos(restaurantId: string, n: number) {
  return Array.from({ length: n }, () => ({ restaurant_id: restaurantId }))
}
function nReviews(restaurantId: string, n: number) {
  return Array.from({ length: n }, () => ({ restaurant_id: restaurantId }))
}
function nPhotos(restaurantId: string, n: number) {
  return Array.from({ length: n }, () => ({ restaurant_id: restaurantId }))
}

// ---------- pure helpers ----------

describe('weightedSum', () => {
  it('returns 0 for empty counts', () => {
    expect(weightedSum({ videos: 0, reviews: 0, photos: 0 })).toBe(0)
  })

  it('applies video + review + photo weights', () => {
    const counts = { videos: 2, reviews: 3, photos: 4 }
    expect(weightedSum(counts)).toBe(
      2 * WEIGHTS.video + 3 * WEIGHTS.review + 4 * WEIGHTS.photo
    )
  })
})

describe('median', () => {
  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0)
  })

  it('returns middle element for odd length', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3)
  })

  it('returns average of two middle elements for even length', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('handles unsorted input', () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3)
  })
})

describe('cutoffForWindow', () => {
  const fixedNow = new Date('2026-04-15T12:00:00.000Z')

  it('computes a 24h cutoff', () => {
    expect(cutoffForWindow('24h', fixedNow)).toBe('2026-04-14T12:00:00.000Z')
  })

  it('computes a 7d cutoff', () => {
    expect(cutoffForWindow('7d', fixedNow)).toBe('2026-04-08T12:00:00.000Z')
  })

  it('computes a 30d cutoff', () => {
    expect(cutoffForWindow('30d', fixedNow)).toBe('2026-03-16T12:00:00.000Z')
  })

  it('the window is actually smaller than 7d for 24h', () => {
    const d24 = new Date(cutoffForWindow('24h', fixedNow)).getTime()
    const d7 = new Date(cutoffForWindow('7d', fixedNow)).getTime()
    expect(d24).toBeGreaterThan(d7)
  })
})

// ---------- scoring pipeline ----------

describe('computeScoresFromData — empty engagement', () => {
  it('returns score 0 for every restaurant when there are no events', () => {
    const data = rawData([
      { id: 'a', city: 'NYC' },
      { id: 'b', city: 'NYC' },
      { id: 'c', city: 'Austin' },
    ])
    const scores = computeScoresFromData(data)
    expect(scores.size).toBe(3)
    for (const score of scores.values()) {
      expect(score.raw_score).toBe(0)
      expect(score.normalized_score).toBe(0)
      expect(score.counts).toEqual({ videos: 0, reviews: 0, photos: 0 })
    }
  })
})

describe('computeScoresFromData — dominant restaurant within its city', () => {
  it('ranks the dominant restaurant #1 in that city', () => {
    // NYC: `a` dominates, `b` has a little, `c` has nothing
    // Austin: `d` has a little
    const data = rawData(
      [
        { id: 'a', city: 'NYC' },
        { id: 'b', city: 'NYC' },
        { id: 'c', city: 'NYC' },
        { id: 'd', city: 'Austin' },
      ],
      {
        videos: [...nVideos('a', 20), ...nVideos('b', 1), ...nVideos('d', 1)],
        reviews: [...nReviews('a', 5)],
      }
    )
    const scores = computeScoresFromData(data)
    const nyc = rankScores(scores, { city: 'NYC' })
    expect(nyc[0].restaurant_id).toBe('a')
    expect(nyc[0].rank).toBe(1)
    expect(nyc[0].score).toBeGreaterThan(nyc[1].score)
  })
})

describe('computeScoresFromData — high-volume city does not drown low-volume city', () => {
  it('a leader of a sparse city can out-rank a middle-of-the-pack NYC restaurant after normalization', () => {
    // NYC has 10 restaurants, most get 10 videos each (baseline = high).
    // `nyc_top` gets 15 videos — it's the NYC leader but only 1.5x above city median.
    // Austin has 2 restaurants: `austin_leader` gets 10 videos, `austin_other` gets 0.
    // austin_leader is dramatically above its city median — should out-rank `nyc_middle`.
    const nycRestaurants = Array.from({ length: 10 }, (_, i) => ({
      id: `nyc_${i}`,
      city: 'NYC' as const,
    }))
    const austinRestaurants = [
      { id: 'austin_leader', city: 'Austin' as const },
      { id: 'austin_other', city: 'Austin' as const },
    ]
    const videos: Array<{ restaurant_id: string }> = []
    // NYC baseline: 10 videos each for nyc_0..nyc_8
    for (let i = 0; i < 9; i++) videos.push(...nVideos(`nyc_${i}`, 10))
    // NYC top gets 15 (1.5x baseline)
    videos.push(...nVideos('nyc_9', 15))
    // Austin leader gets 10, other gets 0
    videos.push(...nVideos('austin_leader', 10))

    const data = rawData([...nycRestaurants, ...austinRestaurants], { videos })
    const scores = computeScoresFromData(data)

    const austinLeader = scores.get('austin_leader')!
    const nycMiddle = scores.get('nyc_0')!
    const nycTop = scores.get('nyc_9')!

    // Austin leader normalizes to something enormous (median of [10, 0] = 5,
    // austin_leader raw=30, so 30/5 = 6.0). NYC middle is exactly median
    // (10 videos, normalized to 1.0). Austin leader wins.
    expect(austinLeader.normalized_score).toBeGreaterThan(nycMiddle.normalized_score)
    // NYC top is 1.5x NYC median, so ~1.5 — still less than austin_leader
    expect(austinLeader.normalized_score).toBeGreaterThan(nycTop.normalized_score)

    // Sanity: raw scores tell the opposite story (NYC top beats Austin leader)
    expect(nycTop.raw_score).toBeGreaterThan(austinLeader.raw_score)
  })
})

describe('computeScoresFromData — window param actually limits the time range', () => {
  // We can't exercise a live DB here without a real Supabase, so we test
  // cutoff calculation (the thing that the I/O layer passes into `.gt()`).
  // Separately, the pipeline itself is window-agnostic — it trusts that
  // the raw data it received was already windowed.
  it('the 24h cutoff is strictly later than the 7d cutoff', () => {
    const fixedNow = new Date('2026-04-15T12:00:00.000Z')
    const cutoff24h = new Date(cutoffForWindow('24h', fixedNow)).getTime()
    const cutoff7d = new Date(cutoffForWindow('7d', fixedNow)).getTime()
    const cutoff30d = new Date(cutoffForWindow('30d', fixedNow)).getTime()
    expect(cutoff24h).toBeGreaterThan(cutoff7d)
    expect(cutoff7d).toBeGreaterThan(cutoff30d)
  })

  it('a shorter window excludes events older than it, included in longer ones', () => {
    // Simulate two event sets: one "last 24h" and one "last 7d minus 24h".
    // With window='24h' only the first should count; with window='7d' both.
    // This is really a test of the calling code's contract — the raw data
    // handed into computeScoresFromData is assumed to be pre-windowed.
    const fixedNow = new Date('2026-04-15T12:00:00.000Z')
    const event24h = new Date('2026-04-15T00:00:00.000Z').toISOString()
    const event6d = new Date('2026-04-09T12:00:00.000Z').toISOString()

    expect(event24h > cutoffForWindow('24h', fixedNow)).toBe(true)
    expect(event24h > cutoffForWindow('7d', fixedNow)).toBe(true)

    expect(event6d > cutoffForWindow('24h', fixedNow)).toBe(false)
    expect(event6d > cutoffForWindow('7d', fixedNow)).toBe(true)
  })
})

describe('rankScores — filters and limits', () => {
  it('filters by city case-insensitively', () => {
    const data = rawData(
      [
        { id: 'a', city: 'New York' },
        { id: 'b', city: 'Austin' },
      ],
      { videos: [...nVideos('a', 5), ...nVideos('b', 3)] }
    )
    const scores = computeScoresFromData(data)
    const nycOnly = rankScores(scores, { city: 'new york' })
    expect(nycOnly).toHaveLength(1)
    expect(nycOnly[0].restaurant_id).toBe('a')
  })

  it('limits the result set', () => {
    const data = rawData(
      Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, city: 'NYC' })),
      { videos: [...nReviews('r0', 1), ...nReviews('r1', 1)] }
    )
    const scores = computeScoresFromData(data)
    const top2 = rankScores(scores, { limit: 2 })
    expect(top2).toHaveLength(2)
    expect(top2[0].rank).toBe(1)
    expect(top2[1].rank).toBe(2)
  })

  it('filters by cuisine', () => {
    const data = rawData(
      [
        { id: 'a', city: 'NYC', cuisine: 'Italian' },
        { id: 'b', city: 'NYC', cuisine: 'Japanese' },
      ],
      { reviews: [...nReviews('a', 3), ...nReviews('b', 10)] }
    )
    const scores = computeScoresFromData(data)
    const italian = rankScores(scores, { cuisine: 'Italian' })
    expect(italian).toHaveLength(1)
    expect(italian[0].restaurant_id).toBe('a')
  })
})
