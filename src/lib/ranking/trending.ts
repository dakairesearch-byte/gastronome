/**
 * Project-wide trending ranking function.
 *
 * This is the ONLY ranking function in Gastronome. If you're sorting
 * restaurants, you're sorting by this. No per-page custom math, no
 * aggregate-rating blends, no placement algorithms — those were all
 * deleted and replaced with this one transparent pipeline.
 *
 * Pipeline (decay formula, NEXT_PUBLIC_TRENDING_FORMULA=decay):
 *   1. Fetch engagement events with their timestamps.
 *   2. For each (restaurant, source, day) bucket apply a per-day log cap,
 *      then multiply by the event-type base weight and an exponential decay
 *      factor: base_weight * log_cap(1+n) * 2^(−Δt/h).
 *   3. Normalize by the median raw score across restaurants in the same
 *      city — this prevents high-volume cities (NYC) from drowning out
 *      low-volume cities (Austin).
 *   4. When a city is too sparse to have a meaningful median (median = 0),
 *      fall back to the global median, then to the raw score.
 *
 * When the flag is OFF (default), the legacy rectangular-window count path
 * runs unchanged: count weighted events inside the window, then steps 3-4.
 *
 * All weights and decay parameters live in `./weights.ts`. Tune there, not here.
 *
 * DECAY FORMULA RATIONALE
 * -----------------------
 * The rectangular-window formula has two documented bugs:
 *
 *   Cliff-edge: a restaurant with videos from 6d 23h ago scores identically to
 *   one with videos from 1h ago; at the window boundary its score drops to
 *   zero with no real-world signal change.
 *
 *   Backfill-spike: 40 TikToks backfilled in one pipeline run contribute
 *   120 pts (40 × 3); one organic video/day for 5 days contributes 15 pts.
 *   The backfill wins 8× despite being a worse freshness signal.
 *
 * The exponential decay + per-day log₂ cap fixes both:
 *   - 40 same-day videos → log₂(41) × 3 × decay ≈ 16 pts at t=0, decaying away
 *   - 5 organic videos → 5 × log₂(2) × 3 × (varying decay) ≈ 7.9 pts
 *   - Backfill advantage: 2× at ingestion, halved every 72h
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Restaurant } from '@/types/database'
import { paginateSelect } from '@/lib/supabase/paginate'
import {
  DECAY,
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
  videoEvents: Array<{ restaurant_id: string; created_at: string }>
  reviewEvents: Array<{ restaurant_id: string; created_at: string }>
  photoEvents: Array<{ restaurant_id: string; created_at: string }>
}

// ---------- Pure helpers (testable without a database) ----------

/**
 * Staged-rollout flag for the decay formula. OFF (legacy rectangular window)
 * unless NEXT_PUBLIC_TRENDING_FORMULA=decay. Remove after 2 weeks of stable
 * decay operation (see gate4 rollout plan).
 */
export function decayEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TRENDING_FORMULA === 'decay'
}

/**
 * Compute the exponential decay weight for an event at a given age.
 * Returns a value in (0, 1]. Weights below DECAY.decayFloor are treated as 0.
 */
export function decayWeight(ageHours: number, halfLifeHours: number): number {
  const w = Math.pow(2, -ageHours / halfLifeHours)
  return w < DECAY.decayFloor ? 0 : w
}

/**
 * Group events by (restaurant_id, UTC day), compute the per-day log cap, and
 * return the total decayed weighted contribution for each restaurant.
 *
 * Each call handles a single event source, so the bucket key is effectively
 * (restaurant, source, day). cap(n) = log_base(1 + n) where
 * base = DECAY.capBase (default 2 = log₂); the decay age is the bucket's
 * mean event timestamp (midpoint for a uniform batch).
 *
 * This ensures a 40-video backfill day contributes log₂(41) ≈ 5.36 effective
 * events rather than 40, collapsing the documented backfill-spike bug.
 */
export function decayedContributions(
  events: Array<{ restaurant_id: string; created_at: string }>,
  baseWeight: number,
  halfLifeHours: number,
  now: Date = new Date()
): Map<string, number> {
  type BucketKey = string // `${restaurant_id}::${YYYY-MM-DD}`
  const buckets = new Map<
    BucketKey,
    { restaurant_id: string; count: number; sumEpoch: number }
  >()

  for (const ev of events) {
    const ts = new Date(ev.created_at)
    if (isNaN(ts.getTime())) continue // skip malformed timestamps
    const dayKey = ts.toISOString().slice(0, 10) // YYYY-MM-DD UTC
    const key: BucketKey = `${ev.restaurant_id}::${dayKey}`
    const existing = buckets.get(key)
    if (existing) {
      existing.count++
      existing.sumEpoch += ts.getTime()
    } else {
      buckets.set(key, { restaurant_id: ev.restaurant_id, count: 1, sumEpoch: ts.getTime() })
    }
  }

  const result = new Map<string, number>()
  const nowMs = now.getTime()
  const logBase = Math.log(DECAY.capBase)

  for (const { restaurant_id, count, sumEpoch } of buckets.values()) {
    const avgAgeHours = (nowMs - sumEpoch / count) / 3_600_000
    const dw = decayWeight(avgAgeHours, halfLifeHours)
    if (dw === 0) continue
    const cap = Math.log(1 + count) / logBase // log_base(1 + n)
    const contribution = baseWeight * cap * dw
    result.set(restaurant_id, (result.get(restaurant_id) ?? 0) + contribution)
  }

  return result
}

/**
 * Compute the raw weighted score from a set of event counts.
 * Used by the legacy rectangular path; retained for callers/tests that have
 * plain EventCounts. The decay path scores via `decayedContributions`.
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
 * Effective lookback in hours under the decay formula, derived from the decay
 * floor and the longest half-life (≈ 10 × max half-life ≈ 70d by default).
 */
export function effectiveLookbackHours(): number {
  const maxHalfLife = Math.max(
    DECAY.videoHalfLifeHours,
    DECAY.reviewHalfLifeHours,
    DECAY.photoHalfLifeHours
  )
  return maxHalfLife * Math.log2(1 / DECAY.decayFloor)
}

/**
 * Compute per-restaurant scores from already-fetched raw data. Pure
 * function — no database access. This is the unit you unit-test.
 *
 * With NEXT_PUBLIC_TRENDING_FORMULA=decay, scores use the exponential decay +
 * per-day cap formula; `counts` then carry effective (capped, decayed) event
 * equivalents rather than raw event tallies. Otherwise the legacy plain-count
 * path runs unchanged.
 */
export function computeScoresFromData(data: RawData): Map<string, ScoreData> {
  const counts = new Map<string, EventCounts>()
  const info = new Map<string, { city: string | null; cuisine: string | null }>()

  for (const r of data.restaurants) {
    counts.set(r.id, { videos: 0, reviews: 0, photos: 0 })
    info.set(r.id, { city: r.city, cuisine: r.cuisine })
  }

  const rawByRestaurant = new Map<string, number>()
  const rawByCity = new Map<string, number[]>()
  const allRaw: number[] = []

  if (decayEnabled()) {
    // Decay path: per-(restaurant, source, day) log cap × exponential decay.
    const videoContribs = decayedContributions(data.videoEvents, WEIGHTS.video, DECAY.videoHalfLifeHours)
    const reviewContribs = decayedContributions(data.reviewEvents, WEIGHTS.review, DECAY.reviewHalfLifeHours)
    const photoContribs = decayedContributions(data.photoEvents, WEIGHTS.photo, DECAY.photoHalfLifeHours)

    for (const [id, meta] of info) {
      const videoC = videoContribs.get(id) ?? 0
      const reviewC = reviewContribs.get(id) ?? 0
      const photoC = photoContribs.get(id) ?? 0
      // Effective event-count equivalents (capped + decayed), for
      // debugTrending and the planned why-chip — not raw tallies.
      counts.set(id, {
        videos: videoC / WEIGHTS.video,
        reviews: reviewC / WEIGHTS.review,
        photos: photoC / WEIGHTS.photo,
      })
      const raw = videoC + reviewC + photoC
      if (!isFinite(raw)) continue // guard against NaN/Infinity
      rawByRestaurant.set(id, raw)
      allRaw.push(raw)
      if (meta.city) {
        const arr = rawByCity.get(meta.city) ?? []
        arr.push(raw)
        rawByCity.set(meta.city, arr)
      }
    }
  } else {
    // Legacy rectangular path: plain in-window counts (timestamps ignored).
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
  }

  const globalMedian = median(allRaw)
  const cityMedians = new Map<string, number>()
  for (const [city, scores] of rawByCity) {
    cityMedians.set(city, median(scores))
  }

  const result = new Map<string, ScoreData>()
  for (const [id, meta] of info) {
    const raw = rawByRestaurant.get(id) ?? 0
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
 *
 * `created_at` timestamps are returned with each event row so that
 * `computeScoresFromData` can compute per-event age for the decay formula.
 * Under the decay flag the lookback extends to the effective decay horizon
 * (≈ 10 × max half-life ≈ 70d by default); with the flag off the legacy
 * rectangular window cutoff applies unchanged.
 */
export async function fetchRawData(
  supabase: Supabase,
  window: Window,
  now: Date = new Date()
): Promise<RawData> {
  const lookbackHours = decayEnabled()
    ? Math.max(WINDOW_HOURS[window], effectiveLookbackHours())
    : WINDOW_HOURS[window]
  const cutoff = new Date(now.getTime() - lookbackHours * 3_600_000).toISOString()

  // All four queries are paginated: PostgREST caps un-ranged responses at
  // 1000 rows, and the restaurants table, any 30d review window, and the
  // 30d photos window can all cross that cap silently.
  const [restaurantRows, videoRows, reviewRows, photoRows] = await Promise.all([
    paginateSelect<{ id: string; city: string | null; cuisine: string | null }>(
      (from, to) =>
        supabase.from('restaurants').select('id, city, cuisine').range(from, to)
    ),
    paginateSelect<{ restaurant_id: string; created_at: string }>((from, to) =>
      supabase
        .from('restaurant_videos')
        .select('restaurant_id, created_at')
        .gt('created_at', cutoff)
        .range(from, to)
    ),
    paginateSelect<{ restaurant_id: string; created_at: string }>((from, to) =>
      supabase
        .from('reviews')
        .select('restaurant_id, created_at')
        .gt('created_at', cutoff)
        .range(from, to)
    ),
    // review_photos.created_at + inner join to reviews for restaurant_id
    paginateSelect<{ created_at: string; reviews: unknown }>((from, to) =>
      supabase
        .from('review_photos')
        .select('created_at, reviews!inner(restaurant_id)')
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
    created_at: v.created_at,
  }))

  const reviewEvents = reviewRows.map((r) => ({
    restaurant_id: r.restaurant_id,
    created_at: r.created_at,
  }))

  // Supabase nested relation shape: `reviews` is either an object or array
  // depending on whether the relation is many-to-one. For review_photos →
  // reviews it's many-to-one, so the expected shape is an object, but we
  // defensively handle both.
  const photoEvents: Array<{ restaurant_id: string; created_at: string }> = []
  for (const row of photoRows) {
    const typedRow = row as unknown as { created_at: string; reviews: unknown }
    const rel = typedRow.reviews
    if (!rel) continue
    if (Array.isArray(rel)) {
      for (const entry of rel) {
        const rid = (entry as { restaurant_id?: string }).restaurant_id
        if (rid) photoEvents.push({ restaurant_id: rid, created_at: typedRow.created_at })
      }
    } else {
      const rid = (rel as { restaurant_id?: string }).restaurant_id
      if (rid) photoEvents.push({ restaurant_id: rid, created_at: typedRow.created_at })
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
  options: TrendingOptions & { limit?: number; allowZeroScores?: boolean } = {}
): Promise<TrendingRestaurant[]> {
  const ranked = await topTrending(supabase, options)
  // By default we drop score-0 entries. But on a quiet window (e.g. 24h with no
  // engagement) every score can be 0, which would blank the trending rail.
  // Callers that render a fixed-size rail can pass `allowZeroScores` to keep
  // the ranked order (tie-broken by raw_score then id) instead of an empty list.
  const selected = options.allowZeroScores ? ranked : ranked.filter((r) => r.score > 0)
  if (selected.length === 0) return []

  // Chunk the id list: a single unbounded `.in()` over thousands of ids
  // (callers that omit `limit`) both overflows the PostgREST GET URL and
  // silently truncates the un-ranged select at the 1000-row default cap.
  const ids = selected.map((r) => r.restaurant_id)
  const byId = new Map<string, Restaurant>()
  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data: rows } = await supabase
      .from('restaurants')
      .select('*')
      .in('id', ids.slice(i, i + CHUNK))
    for (const row of rows ?? []) byId.set(row.id, row as Restaurant)
  }

  const out: TrendingRestaurant[] = []
  for (const entry of selected) {
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
