/**
 * brigadeDetector.ts
 *
 * Stage 7, idea #53 — nightly anomaly pass over reviews.
 *
 * Detection signals (per restaurant, per day):
 *   1. Velocity z-spike: daily review count vs. trailing 30-day mean/stddev.
 *      Flag if z-score > VELOCITY_Z_THRESHOLD (default 3.5).
 *   2. New-account concentration: >50% of a day's raters with
 *      profiles.created_at < 7 days before the review date.
 *   3. Shared hash clusters: >=3 raters on one restaurant sharing the same
 *      ip_hash or ua_hash within a 7-day window.
 *   4. Bimodal pattern: a day's reviews are ≥60% in {1} ∪ {10} (extremes only)
 *      AND n >= MIN_BIMODAL_N (default 5).
 *
 * Actions on a flagged restaurant+day window:
 *   - SET quarantined=true on the suspicious reviews (UPDATE only — never delete)
 *   - Writes one fetch_logs row per flagged restaurant (source='brigade_detector')
 *
 * Cross-check note (per plan §8): real virality has TikTok/Instagram exhaust.
 *   We log the restaurant's video_count in the audit metadata so a human
 *   reviewer can cross-check. We do NOT auto-unquarantine based on video signal
 *   — that is a human decision.
 *
 * --dry flag: default ON — prints actions but writes NOTHING.
 *
 * Usage:
 *   npx tsx scripts/brigadeDetector.ts             # dry-run (safe)
 *   npx tsx scripts/brigadeDetector.ts --write     # quarantine + audit log
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Env loading (.env.local, matching existing TS script convention) ────────
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) {
  console.error('[brigadeDetector] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

const WRITE = args.write === 'true'

// ─── Thresholds ───────────────────────────────────────────────────────────────
const VELOCITY_Z_THRESHOLD = 3.5   // z-score for velocity spike
const NEW_ACCOUNT_DAYS     = 7     // profile younger than this = "new account"
const NEW_ACCOUNT_FRACTION = 0.50  // >50% new accounts in a day = suspicious
const SHARED_HASH_MIN      = 3     // >=3 same ip_hash or ua_hash = suspicious
const BIMODAL_FRACTION     = 0.60  // >=60% of ratings in {1, 10} = bimodal
const MIN_BIMODAL_N        = 5     // bimodal check only if day has >=N ratings

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error(`[brigadeDetector] ${label} fetch error:`, error.message)
      process.exit(1)
    }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

/** Mean and population stddev of an array. Returns {mean:0, stddev:0} if empty. */
function stats(xs: number[]): { mean: number; stddev: number } {
  if (xs.length === 0) return { mean: 0, stddev: 0 }
  const mean   = xs.reduce((s, x) => s + x, 0) / xs.length
  const stddev = xs.length > 1
    ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
    : 0
  return { mean, stddev }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[brigadeDetector] starting — WRITE=${WRITE}`)

  const now     = new Date()
  const cutoff30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const cutoff7  = new Date(now.getTime() -  7 * 86400000).toISOString()

  // ─── 1. Load all reviews in the past 30 days ──────────────────────────────
  type ReviewRow = {
    id: string
    restaurant_id: string
    author_id: string
    rating: number | null
    created_at: string | null
    ip_hash: string | null
    ua_hash: string | null
    quarantined: boolean
  }
  const reviews = await fetchAll<ReviewRow>((from, to) =>
    sb.from('reviews')
      .select('id,restaurant_id,author_id,rating,created_at,ip_hash,ua_hash,quarantined')
      .gte('created_at', cutoff30)
      .order('created_at', { ascending: true })
      .range(from, to),
    'reviews',
  )
  console.log(`[brigadeDetector] loaded ${reviews.length} reviews (30d window)`)

  // ─── 2. Load author profile creation dates ────────────────────────────────
  const authorIds = Array.from(new Set(reviews.map((r) => r.author_id)))
  const profileMap = new Map<string, string>() // author_id → created_at

  // Fetch in batches of 200 (PostgREST .in() URL length limit)
  for (let i = 0; i < authorIds.length; i += 200) {
    const batch = authorIds.slice(i, i + 200)
    const { data, error } = await sb
      .from('profiles')
      .select('id,created_at')
      .in('id', batch)
    if (error) {
      console.warn('[brigadeDetector] profiles fetch warn:', error.message)
    }
    for (const p of data ?? []) {
      if (p.created_at) profileMap.set(p.id, p.created_at)
    }
  }

  // ─── 3. Load video counts per restaurant (7d) for audit metadata ──────────
  type VideoRow = { restaurant_id: string }
  const recentVideos = await fetchAll<VideoRow>((from, to) =>
    sb.from('restaurant_videos')
      .select('restaurant_id')
      .gte('created_at', cutoff7)
      .order('restaurant_id', { ascending: true })
      .range(from, to),
    'restaurant_videos (7d)',
  )
  const videoCountMap = new Map<string, number>()
  for (const v of recentVideos) {
    videoCountMap.set(v.restaurant_id, (videoCountMap.get(v.restaurant_id) ?? 0) + 1)
  }

  // ─── 4. Build per-restaurant per-day buckets ──────────────────────────────
  // Key: `restaurantId|YYYY-MM-DD`
  type DayBucket = {
    restaurantId: string
    day: string   // YYYY-MM-DD
    reviews: ReviewRow[]
  }
  const bucketMap = new Map<string, DayBucket>()
  for (const r of reviews) {
    const day = (r.created_at ?? '').slice(0, 10) || 'unknown'
    const key = `${r.restaurant_id}|${day}`
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { restaurantId: r.restaurant_id, day, reviews: [] })
    }
    bucketMap.get(key)!.reviews.push(r)
  }

  // ─── 5. Compute per-restaurant trailing 30d daily velocity stats ──────────
  // Group all reviews by restaurant → day → count
  const velocityMap = new Map<string, Map<string, number>>() // restaurantId → day → count
  for (const r of reviews) {
    const day = (r.created_at ?? '').slice(0, 10) || 'unknown'
    if (!velocityMap.has(r.restaurant_id)) velocityMap.set(r.restaurant_id, new Map())
    const dayMap = velocityMap.get(r.restaurant_id)!
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
  }

  // For each restaurant, compute mean/stddev of daily counts (excluding today's partial day)
  const today = now.toISOString().slice(0, 10)
  const velStats = new Map<string, { mean: number; stddev: number }>()
  for (const [rid, dayMap] of velocityMap) {
    const counts = Array.from(dayMap.entries())
      .filter(([d]) => d !== today)
      .map(([, c]) => c)
    velStats.set(rid, stats(counts))
  }

  // ─── 6. Shared hash clusters (7d window, per restaurant) ─────────────────
  // Reviews in the last 7 days grouped by restaurant
  const sevenDayReviews = reviews.filter(
    (r) => r.created_at != null && r.created_at >= cutoff7,
  )
  // Map: restaurantId → { ip_hash → Set<author_id>, ua_hash → Set<author_id> }
  type HashMap = { ip: Map<string, Set<string>>; ua: Map<string, Set<string>> }
  const hashClusters = new Map<string, HashMap>()
  for (const r of sevenDayReviews) {
    if (!hashClusters.has(r.restaurant_id)) {
      hashClusters.set(r.restaurant_id, { ip: new Map(), ua: new Map() })
    }
    const hm = hashClusters.get(r.restaurant_id)!
    if (r.ip_hash) {
      if (!hm.ip.has(r.ip_hash)) hm.ip.set(r.ip_hash, new Set())
      hm.ip.get(r.ip_hash)!.add(r.author_id)
    }
    if (r.ua_hash) {
      if (!hm.ua.has(r.ua_hash)) hm.ua.set(r.ua_hash, new Set())
      hm.ua.get(r.ua_hash)!.add(r.author_id)
    }
  }

  // Identify restaurants with shared-hash clusters of size >= SHARED_HASH_MIN
  const sharedHashFlagged = new Set<string>()
  for (const [rid, hm] of hashClusters) {
    for (const [, authors] of hm.ip) {
      if (authors.size >= SHARED_HASH_MIN) sharedHashFlagged.add(rid)
    }
    for (const [, authors] of hm.ua) {
      if (authors.size >= SHARED_HASH_MIN) sharedHashFlagged.add(rid)
    }
  }

  // ─── 7. Detect anomalies per bucket ───────────────────────────────────────
  type AnomalyFlag = 'velocity_spike' | 'new_account_concentration' | 'shared_hash_cluster' | 'bimodal_pattern'
  type Anomaly = {
    restaurantId: string
    day: string
    signals: AnomalyFlag[]
    reviewIds: string[]
    videoCount: number
    details: Record<string, unknown>
  }
  const anomalies: Anomaly[] = []

  for (const bucket of bucketMap.values()) {
    const { restaurantId, day, reviews: dayReviews } = bucket
    const n = dayReviews.length
    if (n === 0) continue

    const signals: AnomalyFlag[] = []
    const details: Record<string, unknown> = { n }

    // Signal 1: velocity z-spike
    const vs = velStats.get(restaurantId)
    if (vs && vs.stddev > 0) {
      const z = (n - vs.mean) / vs.stddev
      details.velocity_z = Math.round(z * 100) / 100
      details.trailing_mean = Math.round(vs.mean * 100) / 100
      if (z > VELOCITY_Z_THRESHOLD) {
        signals.push('velocity_spike')
      }
    } else if (vs && vs.mean === 0 && n >= 3) {
      // Any activity on a normally-silent restaurant is notable
      signals.push('velocity_spike')
      details.velocity_z = 'new_activity'
    }

    // Signal 2: new-account concentration
    const newAccountCount = dayReviews.filter((r) => {
      const created = profileMap.get(r.author_id)
      if (!created) return false
      const reviewDate = new Date(r.created_at ?? day).getTime()
      const profileAge = reviewDate - new Date(created).getTime()
      return profileAge < NEW_ACCOUNT_DAYS * 86400000
    }).length
    const newAccountFrac = n > 0 ? newAccountCount / n : 0
    details.new_account_fraction = Math.round(newAccountFrac * 100) / 100
    if (newAccountFrac > NEW_ACCOUNT_FRACTION && n >= 2) {
      signals.push('new_account_concentration')
    }

    // Signal 3: shared hash cluster (restaurant-level, not per-day; include if applicable)
    if (sharedHashFlagged.has(restaurantId) && day >= cutoff7.slice(0, 10)) {
      signals.push('shared_hash_cluster')
    }

    // Signal 4: bimodal 1s+10s
    if (n >= MIN_BIMODAL_N) {
      const extremes = dayReviews.filter((r) => r.rating === 1 || r.rating === 10).length
      const extremeFrac = extremes / n
      details.bimodal_extreme_fraction = Math.round(extremeFrac * 100) / 100
      if (extremeFrac >= BIMODAL_FRACTION) {
        signals.push('bimodal_pattern')
      }
    }

    if (signals.length > 0) {
      const videoCount = videoCountMap.get(restaurantId) ?? 0
      anomalies.push({
        restaurantId,
        day,
        signals,
        reviewIds: dayReviews.map((r) => r.id),
        videoCount,
        details,
      })
    }
  }

  console.log(`[brigadeDetector] anomalies found: ${anomalies.length}`)
  for (const a of anomalies) {
    const videos = a.videoCount > 0 ? ` (video_count=${a.videoCount} — check virality)` : ''
    console.log(
      `  [${a.day}] ${a.restaurantId} signals=[${a.signals.join(',')}] n=${a.reviewIds.length}${videos}`,
    )
  }

  if (!WRITE) {
    console.log('[brigadeDetector] dry-run — no writes.')
    return
  }

  if (anomalies.length === 0) {
    console.log('[brigadeDetector] no anomalies — nothing to write.')
    return
  }

  // ─── 8. Quarantine flagged reviews (UPDATE only, never delete) ────────────
  // Collect all review IDs to quarantine (skip already-quarantined)
  const allFlaggedIds = new Set<string>()
  for (const a of anomalies) {
    for (const rid of a.reviewIds) allFlaggedIds.add(rid)
  }
  // Filter to only non-quarantined ones
  const alreadyQ = new Set(reviews.filter((r) => r.quarantined).map((r) => r.id))
  const toQuarantine = Array.from(allFlaggedIds).filter((id) => !alreadyQ.has(id))

  let quarantined = 0
  const Q_BATCH = 100
  for (let i = 0; i < toQuarantine.length; i += Q_BATCH) {
    const batch = toQuarantine.slice(i, i + Q_BATCH)
    const { error } = await sb
      .from('reviews')
      .update({ quarantined: true })
      .in('id', batch)
    if (error) {
      console.error(`[brigadeDetector] quarantine error batch ${i / Q_BATCH}:`, error.message)
    } else {
      quarantined += batch.length
    }
  }
  console.log(`[brigadeDetector] quarantined ${quarantined} reviews (${alreadyQ.size} were already quarantined)`)

  // ─── 9. Write audit lines to fetch_logs ───────────────────────────────────
  const now2 = new Date().toISOString()
  const logRows = anomalies.map((a) => ({
    source: 'brigade_detector',
    status: 'flagged',
    restaurant_id: a.restaurantId,
    started_at:   now2,
    completed_at: now2,
    metadata: {
      day:         a.day,
      signals:     a.signals,
      review_ids:  a.reviewIds,
      video_count: a.videoCount,
      details:     a.details,
    },
  }))

  const LOG_BATCH = 200
  let logged = 0
  for (let i = 0; i < logRows.length; i += LOG_BATCH) {
    const batch = logRows.slice(i, i + LOG_BATCH)
    const { error } = await sb.from('fetch_logs').insert(batch)
    if (error) {
      console.error(`[brigadeDetector] fetch_logs insert error batch ${i / LOG_BATCH}:`, error.message)
    } else {
      logged += batch.length
    }
  }
  console.log(`[brigadeDetector] wrote ${logged} fetch_logs audit rows`)
  console.log('[brigadeDetector] done.')
}

main().catch((e) => {
  console.error('[brigadeDetector] crashed:', e)
  process.exit(1)
})
