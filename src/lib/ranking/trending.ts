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

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Restaurant } from '@/types/database'
import { paginateSelect } from '@/lib/supabase/paginate'
import {
  DEFAULT_WINDOW,
  WEIGHTS,
  WINDOW_HOURS,
  type Window,
} from './weights'

type Supabase = SupabaseClient<Database>

/** A restaurant with the trending rank and score attached. */
export type TrendingRestaurant = Restaurant & {
  trending_rank: number
  trending_score: number
  trending_counts: EventCounts
}

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

  // All four queries are paginated: PostgREST caps un-ranged responses at
  // 1000 rows, and the restaurants table, any 30d review window, and the
  // 30d photos window can all cross that cap silently.
  const [restaurantRows, videoRows, reviewRows, photoRows] = await Promise.all([
    paginateSelect<{ id: string; city: string | null; cuisine: string | null }>(
      (from, to) =>
        supabase.from('restaurants').select('id, city, cuisine').range(from, to)
    ),
    paginateSelect<{ restaurant_id: string }>((from, to) =>
      supabase
        .from('restaurant_videos')
        .select('restaurant_id')
        .gt('created_at', cutoff)
        .range(from, to)
    ),
    paginateSelect<{ restaurant_id: string }>((from, to) =>
      supabase
        .from('reviews')
        .select('restaurant_id')
        .gt('created_at', cutoff)
        .range(from, to)
    ),
    // review_photos.created_at + inner join to reviews for restaurant_id
    paginateSelect<{ reviews: unknown }>((from, to) =>
      supabase
        .from('review_photos')
        .select('reviews!inner(restaurant_id)')
        .gt('created_at', cutoff)
        .range(from, to)
    ),
  ])

  const restaurants = restaurantRows.map((r) => ({
    id: r.id,
    city: r.city,
    cuisine: r.cuisine,
  }))

  const videoEvents = videoRows.map((v) => ({
    restaurant_id: v.restaurant_id,
  }))

  const reviewEvents = reviewRows.map((r) => ({
    restaurant_id: r.restaurant_id,
  }))

  // Supabase nested relation shape: `reviews` is either an object or array
  // depending on whether the relation is many-to-one. For review_photos →
  // reviews it's many-to-one, so the expected shape is an object, but we
  // defensively handle both.
  const photoEvents: Array<{ restaurant_id: string }> = []
  for (const row of photoRows) {
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
 *
 * Memoized per-request via `React.cache` so that a single page rendering
 * multiple trending rails (e.g. global + city-scoped) doesn't recompute
 * the score map. The memoization key is (supabase, window); because the
 * supabase client is typically the same instance within a request, the
 * second call for the same window is a hash-map hit.
 */
export const computeAllScores = cache(async function computeAllScores(
  supabase: Supabase,
  window: Window = DEFAULT_WINDOW
): Promise<Map<string, ScoreData>> {
  const data = await fetchRawData(supabase, window)
  return computeScoresFromData(data)
})

// ---------- Public API ----------

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
 * Like `topTrending`, but joins each entry back to the full restaurant row
 * so the caller can render cards without a second query. Entries with a
 * score of 0 are dropped — the caller shouldn't have to filter them out.
 */
export async function topTrendingRestaurants(
  supabase: Supabase,
  options: TrendingOptions & { limit?: number } = {}
): Promise<TrendingRestaurant[]> {
  const ranked = await topTrending(supabase, options)
  const nonZero = ranked.filter((r) => r.score > 0)
  if (nonZero.length === 0) return []

  const { data: rows } = await supabase
    .from('restaurants')
    .select('*')
    .in(
      'id',
      nonZero.map((r) => r.restaurant_id)
    )

  const byId = new Map<string, Restaurant>()
  for (const row of rows ?? []) byId.set(row.id, row as Restaurant)

  const out: TrendingRestaurant[] = []
  for (const entry of nonZero) {
    const row = byId.get(entry.restaurant_id)
    if (!row) continue
    out.push({
      ...row,
      trending_rank: entry.rank,
      trending_score: entry.score,
      trending_counts: entry.counts,
    })
  }
  return out
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
