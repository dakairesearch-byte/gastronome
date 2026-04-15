/**
 * Project-wide trending ranking function.
 *
 * This is the ONLY ranking function in Gastronome. If you're sorting
 * restaurants, you're sorting by this. No per-page custom math, no
 * aggregate-rating blends, no placement algorithms — those were all
 * deleted and replaced with this one transparent pipeline.
 *
 * Pipeline:
 *   1. Count weighted engagement events inside a time window.
 *   2. Compute the raw score (sum of event_count * weight).
 *   3. Normalize by the median raw score across restaurants in the same
 *      city — this prevents high-volume cities (NYC) from drowning out
 *      low-volume cities (Austin).
 *   4. When a city is too sparse to have a meaningful median (median = 0),
 *      fall back to the global median, then to the raw score.
 *
 * All weights live in `./weights.ts`. Tune ranking there, not here.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  DEFAULT_WINDOW,
  WEIGHTS,
  WINDOW_HOURS,
  type Window,
} from './weights'

type Supabase = SupabaseClient<Database>

export interface TrendingOptions {
  city?: string
  cuisine?: string
  window?: Window
}

export interface EventCounts {
  videos: number
  reviews: number
  photos: number
}

export interface ScoreData {
  restaurant_id: string
  city: string | null
  cuisine: string | null
  counts: EventCounts
  raw_score: number
  normalized_score: number
}

export interface TopTrendingEntry {
  restaurant_id: string
  score: number
  rank: number
  counts: EventCounts
}

export interface RawData {
  restaurants: Array<{ id: string; city: string | null; cuisine: string | null }>
  videoEvents: Array<{ restaurant_id: string }>
  reviewEvents: Array<{ restaurant_id: string }>
  photoEvents: Array<{ restaurant_id: string }>
}

// ---------- Pure helpers (testable without a database) ----------

/**
 * Compute the raw weighted score from a set of event counts.
 */
export function weightedSum(counts: EventCounts): number {
  return (
    counts.videos * WEIGHTS.video +
    counts.reviews * WEIGHTS.review +
    counts.photos * WEIGHTS.photo
  )
}

/**
 * Median of a number array. Returns 0 for an empty array. Stable sort.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * The ISO timestamp marking the start of a trending window, relative to now.
 * Exposed for testing: you can pass a fixed `now` to get a deterministic
 * cutoff without mocking the clock.
 */
export function cutoffForWindow(window: Window, now: Date = new Date()): string {
  const hours = WINDOW_HOURS[window]
  return new Date(now.getTime() - hours * 3600 * 1000).toISOString()
}

/**
 * Compute per-restaurant scores from already-fetched raw data. Pure
 * function — no database access. This is the unit you unit-test.
 */
export function computeScoresFromData(data: RawData): Map<string, ScoreData> {
  const counts = new Map<string, EventCounts>()
  const info = new Map<string, { city: string | null; cuisine: string | null }>()

  for (const r of data.restaurants) {
    counts.set(r.id, { videos: 0, reviews: 0, photos: 0 })
    info.set(r.id, { city: r.city, cuisine: r.cuisine })
  }

  for (const v of data.videoEvents) {
    const e = counts.get(v.restaurant_id)
    if (e) e.videos++
  }
  for (const r of data.reviewEvents) {
    const e = counts.get(r.restaurant_id)
    if (e) e.reviews++
  }
  for (const p of data.photoEvents) {
    const e = counts.get(p.restaurant_id)
    if (e) e.photos++
  }

  // Compute raw scores
  const rawByRestaurant = new Map<string, number>()
  const rawByCity = new Map<string, number[]>()
  const allRaw: number[] = []

  for (const [id, meta] of info) {
    const c = counts.get(id)!
    const raw = weightedSum(c)
    rawByRestaurant.set(id, raw)
    allRaw.push(raw)
    if (meta.city) {
      const arr = rawByCity.get(meta.city) ?? []
      arr.push(raw)
      rawByCity.set(meta.city, arr)
    }
  }

  const globalMedian = median(allRaw)
  const cityMedians = new Map<string, number>()
  for (const [city, scores] of rawByCity) {
    cityMedians.set(city, median(scores))
  }

  const result = new Map<string, ScoreData>()
  for (const [id, meta] of info) {
    const raw = rawByRestaurant.get(id)!
    const cityMed = meta.city ? cityMedians.get(meta.city) ?? 0 : 0
    const denominator = cityMed > 0 ? cityMed : globalMedian
    const normalized = denominator > 0 ? raw / denominator : raw
    result.set(id, {
      restaurant_id: id,
      city: meta.city,
      cuisine: meta.cuisine,
      counts: counts.get(id)!,
      raw_score: raw,
      normalized_score: normalized,
    })
  }
  return result
}

/**
 * Rank entries by normalized score, optionally filtered by city/cuisine.
 * Pure function on already-scored data.
 */
export function rankScores(
  scores: Map<string, ScoreData>,
  options: { city?: string; cuisine?: string; limit?: number } = {}
): TopTrendingEntry[] {
  let list = Array.from(scores.values())
  if (options.city) {
    const target = options.city.toLowerCase()
    list = list.filter((s) => s.city?.toLowerCase() === target)
  }
  if (options.cuisine) {
    const target = options.cuisine.toLowerCase()
    list = list.filter((s) => s.cuisine?.toLowerCase() === target)
  }
  list.sort((a, b) => {
    if (b.normalized_score !== a.normalized_score) {
      return b.normalized_score - a.normalized_score
    }
    // Tiebreak: higher raw score wins, then stable by id
    if (b.raw_score !== a.raw_score) return b.raw_score - a.raw_score
    return a.restaurant_id.localeCompare(b.restaurant_id)
  })
  const limit = options.limit ?? list.length
  return list.slice(0, limit).map((s, i) => ({
    restaurant_id: s.restaurant_id,
    score: s.normalized_score,
    rank: i + 1,
    counts: s.counts,
  }))
}

// ---------- Database-facing helpers (side-effectful I/O) ----------

/**
 * Fetch all the raw data needed to score restaurants inside a time window.
 * Event queries filter on `created_at` (i.e. "new to Gastronome inside the
 * window"), not on source publish timestamps. Photos are joined back to
 * their parent review to derive a restaurant_id.
 */
export async function fetchRawData(
  supabase: Supabase,
  window: Window,
  now: Date = new Date()
): Promise<RawData> {
  const cutoff = cutoffForWindow(window, now)

  const [restaurantRes, videoRes, reviewRes, photoRes] = await Promise.all([
    supabase.from('restaurants').select('id, city, cuisine'),
    supabase
      .from('restaurant_videos')
      .select('restaurant_id')
      .gt('created_at', cutoff),
    supabase
      .from('reviews')
      .select('restaurant_id')
      .gt('created_at', cutoff),
    // review_photos.created_at + inner join to reviews for restaurant_id
    supabase
      .from('review_photos')
      .select('reviews!inner(restaurant_id)')
      .gt('created_at', cutoff),
  ])

  const restaurants = (restaurantRes.data ?? []).map((r) => ({
    id: r.id,
    city: r.city,
    cuisine: r.cuisine,
  }))

  const videoEvents = (videoRes.data ?? []).map((v) => ({
    restaurant_id: v.restaurant_id,
  }))

  const reviewEvents = (reviewRes.data ?? []).map((r) => ({
    restaurant_id: r.restaurant_id,
  }))

  // Supabase nested relation shape: `reviews` is either an object or array
  // depending on whether the relation is many-to-one. For review_photos →
  // reviews it's many-to-one, so the expected shape is an object, but we
  // defensively handle both.
  const photoEvents: Array<{ restaurant_id: string }> = []
  for (const row of photoRes.data ?? []) {
    const rel = (row as unknown as { reviews: unknown }).reviews
    if (!rel) continue
    if (Array.isArray(rel)) {
      for (const entry of rel) {
        const rid = (entry as { restaurant_id?: string }).restaurant_id
        if (rid) photoEvents.push({ restaurant_id: rid })
      }
    } else {
      const rid = (rel as { restaurant_id?: string }).restaurant_id
      if (rid) photoEvents.push({ restaurant_id: rid })
    }
  }

  return { restaurants, videoEvents, reviewEvents, photoEvents }
}

/**
 * Full pipeline: fetch raw data and compute scores.
 */
export async function computeAllScores(
  supabase: Supabase,
  window: Window = DEFAULT_WINDOW
): Promise<Map<string, ScoreData>> {
  const data = await fetchRawData(supabase, window)
  return computeScoresFromData(data)
}

// ---------- Public API ----------

/**
 * Return the trending score for a single restaurant in a given window.
 * Score is normalized by the restaurant's city median and is comparable
 * only within the same call's `window`.
 */
export async function trendingScore(
  supabase: Supabase,
  restaurantId: string,
  options: TrendingOptions = {}
): Promise<number> {
  const scores = await computeAllScores(supabase, options.window ?? DEFAULT_WINDOW)
  return scores.get(restaurantId)?.normalized_score ?? 0
}

/**
 * Return the top N trending restaurants by normalized score, optionally
 * filtered by city and/or cuisine. Each entry carries its rank (1-indexed)
 * and the raw event counts that fed its score.
 */
export async function topTrending(
  supabase: Supabase,
  options: TrendingOptions & { limit?: number } = {}
): Promise<TopTrendingEntry[]> {
  const scores = await computeAllScores(
    supabase,
    options.window ?? DEFAULT_WINDOW
  )
  return rankScores(scores, {
    city: options.city,
    cuisine: options.cuisine,
    limit: options.limit,
  })
}

/**
 * Return the raw score data (counts, raw score, normalized score) for a
 * specific restaurant. Used by the admin debug endpoint so we can answer
 * "why is X trending?" with real numbers.
 */
export async function debugTrending(
  supabase: Supabase,
  restaurantId: string,
  options: TrendingOptions = {}
): Promise<ScoreData | null> {
  const scores = await computeAllScores(supabase, options.window ?? DEFAULT_WINDOW)
  return scores.get(restaurantId) ?? null
}
