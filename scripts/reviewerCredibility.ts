/**
 * reviewerCredibility.ts
 *
 * Stage 7, idea #49 — nightly user_trust recompute.
 *
 * Trust weight formula (four components blended, capped to [0.05, 2.0]):
 *
 *   1. BREADTH (0..1): distinct restaurants rated / sqrt(total restaurants)
 *      — rewards range without penalizing focus; asymptotes naturally.
 *      Also: distinct neighborhoods / total neighborhoods sampled,
 *      averaged with the restaurant breadth.
 *
 *   2. SCALE-ENTROPY (0..1): Shannon entropy of the user's rating distribution
 *      over decile buckets. Accounts that use only one rating value (all-10s,
 *      all-5s) get entropy → 0, decaying toward trust floor 0.05.
 *
 *   3. CONSENSUS (0..0.3 contribution — capped at ~30% of the blend):
 *      Pearson correlation between the user's ratings and the restaurant
 *      community_stats.mean_calibrated (the algorithmic prior). This rewards
 *      raters who agree with the prior without punishing honest contrarians.
 *      The 30% cap is the hard limit per the plan — honest outliers survive.
 *
 *   4. IDENTITY_TIER floor/ceiling: identity_tier from the reviews table.
 *      tier 0 → multiplier 0.8; tier 1 → 1.0; tier 2 → 1.2.
 *      The final weight is then clamped to [0.05, 2.0].
 *
 * Blend: trust_weight = clamp(breadth * 0.40 + entropy * 0.30 + consensus * 0.30, 0.05, 2.0)
 *        then multiplied by the identity_tier multiplier.
 *
 * Users with < MIN_RATINGS reviews are not touched — their default 0.25 stands.
 *
 * Output: UPSERTs user_trust with components jsonb for audit.
 *
 * --dry flag: default ON — prints actions but writes NOTHING.
 *
 * Usage:
 *   npx tsx scripts/reviewerCredibility.ts            # dry-run (safe)
 *   npx tsx scripts/reviewerCredibility.ts --write    # persist to user_trust
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
  console.error('[reviewerCredibility] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
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

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_RATINGS         = 3     // fewer than this → skip (default 0.25 stands)
const TRUST_FLOOR         = 0.05
const TRUST_CEIL          = 2.0
const WEIGHT_BREADTH      = 0.40
const WEIGHT_ENTROPY      = 0.30
const WEIGHT_CONSENSUS    = 0.30  // hard cap: consensus can never exceed 30% of the blend
const ENTROPY_BUCKETS     = 10    // decile buckets for entropy
const IDENTITY_MULTIPLIER = [0.8, 1.0, 1.2] as const // tier 0, 1, 2

// ─── Math helpers ─────────────────────────────────────────────────────────────
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/** Shannon entropy of a discrete distribution (normalised to [0,1] over nBuckets). */
function shannonEntropy(counts: number[], nBuckets: number): number {
  const total = counts.reduce((s, c) => s + c, 0)
  if (total === 0) return 0
  let h = 0
  for (const c of counts) {
    if (c === 0) continue
    const p = c / total
    h -= p * Math.log2(p)
  }
  const maxH = Math.log2(nBuckets)
  return maxH > 0 ? h / maxH : 0
}

/**
 * Pearson correlation between two arrays of equal length.
 * Returns 0 if either array has no variance.
 */
function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom > 0 ? num / denom : 0
}

// ─── Pagination helper ────────────────────────────────────────────────────────
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error(`[reviewerCredibility] ${label} fetch error:`, error.message)
      process.exit(1)
    }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[reviewerCredibility] starting — WRITE=${WRITE}`)

  // ─── 1. Load all non-quarantined reviews ──────────────────────────────────
  type ReviewRow = {
    id: string
    author_id: string
    restaurant_id: string
    rating: number | null
    identity_tier: number
  }
  const reviews = await fetchAll<ReviewRow>((from, to) =>
    sb.from('reviews')
      .select('id,author_id,restaurant_id,rating,identity_tier')
      .eq('quarantined', false)
      .order('author_id', { ascending: true })
      .range(from, to),
    'reviews',
  )
  console.log(`[reviewerCredibility] loaded ${reviews.length} non-quarantined reviews`)

  // ─── 2. Load restaurant community stats for consensus signal ─────────────
  type CommunityRow = { restaurant_id: string; mean_calibrated: number | null }
  const communityRows = await fetchAll<CommunityRow>((from, to) =>
    sb.from('restaurant_community_stats')
      .select('restaurant_id,mean_calibrated')
      .not('mean_calibrated', 'is', null)
      .order('restaurant_id', { ascending: true })
      .range(from, to),
    'restaurant_community_stats',
  )
  const communityMap = new Map<string, number>()
  for (const r of communityRows) {
    if (r.mean_calibrated != null) communityMap.set(r.restaurant_id, r.mean_calibrated)
  }
  console.log(`[reviewerCredibility] community stats loaded: ${communityMap.size} restaurants`)

  // ─── 3. Load all distinct neighborhoods from restaurants (breadth denom) ──
  type RestNeighborhood = { id: string; neighborhood: string | null }
  const restaurants = await fetchAll<RestNeighborhood>((from, to) =>
    sb.from('restaurants')
      .select('id,neighborhood')
      .order('id', { ascending: true })
      .range(from, to),
    'restaurants (neighborhood)',
  )
  const totalRestaurants = restaurants.length
  const allNeighborhoods = new Set<string>()
  const restaurantNeighborhood = new Map<string, string>()
  for (const r of restaurants) {
    if (r.neighborhood) {
      allNeighborhoods.add(r.neighborhood)
      restaurantNeighborhood.set(r.id, r.neighborhood)
    }
  }
  const totalNeighborhoods = Math.max(allNeighborhoods.size, 1)
  console.log(`[reviewerCredibility] total restaurants=${totalRestaurants} distinct_neighborhoods=${totalNeighborhoods}`)

  // ─── 4. Group reviews by author ───────────────────────────────────────────
  type AuthorData = {
    restaurantIds: Set<string>
    neighborhoodIds: Set<string>
    ratings: number[]
    restaurantRatings: Array<{ restaurantId: string; rating: number }>
    maxIdentityTier: number
  }
  const byAuthor = new Map<string, AuthorData>()

  for (const r of reviews) {
    if (!byAuthor.has(r.author_id)) {
      byAuthor.set(r.author_id, {
        restaurantIds:     new Set(),
        neighborhoodIds:   new Set(),
        ratings:           [],
        restaurantRatings: [],
        maxIdentityTier:   0,
      })
    }
    const d = byAuthor.get(r.author_id)!
    d.restaurantIds.add(r.restaurant_id)
    const nbhd = restaurantNeighborhood.get(r.restaurant_id)
    if (nbhd) d.neighborhoodIds.add(nbhd)
    if (r.rating != null) {
      d.ratings.push(r.rating)
      d.restaurantRatings.push({ restaurantId: r.restaurant_id, rating: r.rating })
    }
    if (r.identity_tier > d.maxIdentityTier) d.maxIdentityTier = r.identity_tier
  }

  console.log(`[reviewerCredibility] distinct reviewers: ${byAuthor.size}`)

  // ─── 5. Compute trust for each reviewer ───────────────────────────────────
  type TrustRow = {
    user_id: string
    weight: number
    computed_at: string
    components: {
      breadth: number
      entropy: number
      consensus: number
      identity_tier: number
      identity_multiplier: number
      n_ratings: number
      n_restaurants: number
      n_neighborhoods: number
    }
  }
  const trustRows: TrustRow[] = []
  const now = new Date().toISOString()

  for (const [userId, data] of byAuthor) {
    const nRatings = data.ratings.length
    if (nRatings < MIN_RATINGS) continue

    // Component 1: breadth
    const restBreadth  = data.restaurantIds.size / Math.sqrt(Math.max(totalRestaurants, 1))
    const nbhdBreadth  = data.neighborhoodIds.size / Math.sqrt(Math.max(totalNeighborhoods, 1))
    const breadth      = clamp((restBreadth + nbhdBreadth) / 2, 0, 1)

    // Component 2: entropy of rating distribution (decile buckets 1..10)
    const bucketCounts = new Array<number>(ENTROPY_BUCKETS).fill(0)
    for (const r of data.ratings) {
      // ratings 1-10 → buckets 0-9
      const bucket = clamp(Math.floor(r) - 1, 0, ENTROPY_BUCKETS - 1)
      bucketCounts[bucket]++
    }
    const entropy = shannonEntropy(bucketCounts, ENTROPY_BUCKETS)

    // Component 3: consensus correlation with community mean_calibrated (capped at 30%)
    // Restrict to restaurants that have a community score
    const paired = data.restaurantRatings.filter((rr) => communityMap.has(rr.restaurantId))
    let consensus = 0
    if (paired.length >= 3) {
      const userRatings = paired.map((rr) => rr.rating)
      const communityRatings = paired.map((rr) => communityMap.get(rr.restaurantId)!)
      const r = pearsonR(userRatings, communityRatings)
      // Map correlation [-1, 1] → [0, 1]: a rater with r=1 gets full score,
      // r=0 (independent) gets 0.5, r=-1 (contrarian) gets 0 but still survives
      // because consensus is only 30% of the blend.
      consensus = clamp((r + 1) / 2, 0, 1)
    } else {
      consensus = 0.5 // neutral for reviewers with insufficient overlap
    }

    // Blend (before identity tier)
    const blended = breadth * WEIGHT_BREADTH + entropy * WEIGHT_ENTROPY + consensus * WEIGHT_CONSENSUS

    // Identity tier multiplier
    const tier   = clamp(data.maxIdentityTier, 0, 2) as 0 | 1 | 2
    const mult   = IDENTITY_MULTIPLIER[tier]
    const weight = clamp(blended * mult, TRUST_FLOOR, TRUST_CEIL)

    trustRows.push({
      user_id:    userId,
      weight:     Math.round(weight * 10000) / 10000,
      computed_at: now,
      components: {
        breadth:              Math.round(breadth * 10000) / 10000,
        entropy:              Math.round(entropy * 10000) / 10000,
        consensus:            Math.round(consensus * 10000) / 10000,
        identity_tier:        tier,
        identity_multiplier:  mult,
        n_ratings:            nRatings,
        n_restaurants:        data.restaurantIds.size,
        n_neighborhoods:      data.neighborhoodIds.size,
      },
    })
  }

  console.log(`[reviewerCredibility] computed trust for ${trustRows.length} users`)

  if (!WRITE) {
    console.log('[reviewerCredibility] dry-run — first 5 rows:')
    console.log(JSON.stringify(trustRows.slice(0, 5), null, 2))
    console.log('[reviewerCredibility] done (no writes).')
    return
  }

  // ─── 6. UPSERT user_trust in batches of 500 ───────────────────────────────
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < trustRows.length; i += BATCH) {
    const batch = trustRows.slice(i, i + BATCH)
    const { error } = await sb
      .from('user_trust')
      .upsert(batch, { onConflict: 'user_id' })
    if (error) {
      console.error(`[reviewerCredibility] upsert error batch ${i / BATCH}:`, error.message)
      process.exit(1)
    }
    upserted += batch.length
  }
  console.log(`[reviewerCredibility] upserted ${upserted} rows into user_trust`)
  console.log('[reviewerCredibility] done.')
}

main().catch((e) => {
  console.error('[reviewerCredibility] crashed:', e)
  process.exit(1)
})
