/**
 * computeCommunityStats.ts
 *
 * Nightly recompute of restaurant_community_stats and user_rating_stats from
 * first principles. Full recompute — idempotent, safe to re-run.
 *
 * Aggregation math (§2 of ENGAGEMENT_AND_COMMUNITY_SCORING_2026-06-09.md):
 *
 *   1. user_rating_stats — per-user (μ_u, σ_u) shrunk toward the population mean
 *      with pseudo-count m=5.  σ floor = 0.75.
 *
 *   2. Per-rating calibration:
 *        calibrated = clamp(μ_pop + (r − μ_u_shrunk) * (σ_pop / max(σ_u_shrunk, 0.75)), 1, 10)
 *      where μ_u_shrunk = (μ_pop*5 + n_u*μ_u) / (5 + n_u)
 *
 *   3. Trimmed (drop top+bottom 10% of weight mass), Bayesian-shrunk community score:
 *        C = (μ0*k + Σ w_i*cal_i) / (k + Σ w_i)   μ0=6.8, k=8
 *
 *   4. ci_halfwidth via t-approx:  s / sqrt(n_eff)
 *      where n_eff = (Σ w_i)^2 / Σ(w_i^2)  (effective-n for weighted data)
 *
 *   5. Elo from restaurant_comparisons: K=32 for first 30 comparisons, then K=16.
 *      Seed: 1500 + 100*(gastronomeScore - 7) if score exists, else 1400.
 *      NOTE: nightly Bradley-Terry refinement (MM algorithm) is a TODO —
 *      currently uses online Elo only.
 *
 * Usage:
 *   npx tsx scripts/computeCommunityStats.ts            # dry-run
 *   npx tsx scripts/computeCommunityStats.ts --write    # persist
 *   npx tsx scripts/computeCommunityStats.ts --sleep    # random 0-20 min sleep first
 *   npx tsx scripts/computeCommunityStats.ts --restaurant=<id>  # single restaurant
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { gastronomeScore } from '../src/lib/score'

// ─── Env loading (.env.local, matching existing script convention) ────────────
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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
) as Record<string, string>
const WRITE        = args.write        === 'true'
const DO_SLEEP     = args.sleep        === 'true'
const RESTAURANT   = args.restaurant   ?? null

// ─── Constants (§2 math) ─────────────────────────────────────────────────────
const MU0 = 6.8    // Bayesian prior mean
const K   = 8      // Bayesian pseudo-count
const M_PSEUDO = 5 // per-user shrinkage pseudo-count toward population mean
const SIGMA_FLOOR = 0.75
const TRIM_FRACTION = 0.10  // drop top+bottom 10% of weight mass
const ELO_K_HIGH  = 32      // K for first 30 comparisons
const ELO_K_LOW   = 16      // K after 30 comparisons
const ELO_K_CUTOFF = 30
const ELO_DEFAULT  = 1400   // seed for scoreless restaurants
const ELO_SEED_OFFSET = 1500
const ELO_SEED_SCALE  = 100

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * Page through a PostgREST query. supabase-js silently caps un-ranged selects
 * at 1000 rows — restaurants alone has 3000+, so every full-table read here
 * MUST paginate or the recompute runs on a partial dataset.
 * The builder must apply a stable .order() so pages don't overlap.
 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error(`[communityStats] ${label} fetch error:`, error.message)
      process.exit(1)
    }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

/** Weighted sample variance (Bessel-corrected via effective-n). */
function weightedStats(vals: number[], weights: number[]): { mean: number; variance: number; sumW: number; n: number } {
  const sumW  = weights.reduce((s, w) => s + w, 0)
  if (sumW === 0) return { mean: 0, variance: 0, sumW: 0, n: 0 }
  const mean  = vals.reduce((s, v, i) => s + v * weights[i], 0) / sumW
  const sumW2 = weights.reduce((s, w) => s + w * w, 0)
  const nEff  = (sumW * sumW) / sumW2  // effective sample size
  const variance = nEff > 1
    ? vals.reduce((s, v, i) => s + weights[i] * (v - mean) ** 2, 0) / (sumW * (1 - 1 / nEff))
    : 0
  return { mean, variance, sumW, n: vals.length }
}

/** Drop top+bottom fraction of weight mass (sorted asc by value). */
function trimByWeightMass(
  vals: number[],
  weights: number[],
  fraction: number,
): { vals: number[]; weights: number[] } {
  if (vals.length === 0) return { vals: [], weights: [] }
  const totalW = weights.reduce((s, w) => s + w, 0)
  const cutEach = fraction * totalW
  // sort ascending
  const pairs = vals.map((v, i) => [v, weights[i]] as [number, number])
  pairs.sort((a, b) => a[0] - b[0])
  const out: typeof pairs = []
  let removeLow  = cutEach
  let removeHigh = cutEach
  for (let i = 0; i < pairs.length; i++) {
    const [v, w] = pairs[i]
    if (removeLow > 0) {
      const take = Math.max(0, w - removeLow)
      removeLow -= w - take
      if (take > 0) out.push([v, take])
    } else {
      out.push([v, w])
    }
  }
  // trim from high end
  let trimmed: typeof pairs = []
  for (let i = out.length - 1; i >= 0; i--) {
    const [v, w] = out[i]
    if (removeHigh > 0) {
      const take = Math.max(0, w - removeHigh)
      removeHigh -= w - take
      if (take > 0) trimmed.unshift([v, take])
    } else {
      trimmed.unshift(out[i])
    }
  }
  return {
    vals:    trimmed.map((p) => p[0]),
    weights: trimmed.map((p) => p[1]),
  }
}

/** t-distribution CI halfwidth.  Uses t≈2.0 (≈ 95% CI; conservative for small n). */
function ciHalfwidth(variance: number, sumW: number, sumW2: number): number {
  const nEff = sumW > 0 ? (sumW * sumW) / sumW2 : 0
  if (nEff < 2) return 0
  const se = Math.sqrt(variance / nEff)
  return 2.0 * se  // t ≈ 2.0 for 95% CI
}

// ─── Elo online update ────────────────────────────────────────────────────────
function eloUpdate(
  ratingW: number,
  ratingL: number,
  kW: number,
  kL: number,
  trustWeight: number,
): { newW: number; newL: number } {
  const expectedW = 1 / (1 + 10 ** ((ratingL - ratingW) / 400))
  const effectiveK = trustWeight  // scale K by comparison trust_weight
  const deltaW = effectiveK * kW * (1 - expectedW)
  const deltaL = effectiveK * kL * (0 - (1 - expectedW))
  return { newW: ratingW + deltaW, newL: ratingL + deltaL }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Optional random sleep (0-20 min) to jitter run timing and deny attackers a
  // feedback loop against the exact cron fire time (§2 §5 of the plan).
  if (DO_SLEEP) {
    const sleepMs = Math.floor(Math.random() * 20 * 60 * 1000)
    console.log(`[communityStats] sleeping ${Math.round(sleepMs / 1000)}s (jitter)`)
    await new Promise((r) => setTimeout(r, sleepMs))
  }

  console.log(`[communityStats] starting — WRITE=${WRITE}${RESTAURANT ? ` restaurant=${RESTAURANT}` : ''}`)

  // ─── 1. Load all non-quarantined ratings (paginated) ─────────────────────
  type ReviewRow = {
    id: string
    restaurant_id: string
    author_id: string
    rating: number | null
    would_return: boolean | null
    trust_weight: number | string | null
  }
  const reviews = await fetchAll<ReviewRow>((from, to) => {
    let q = sb
      .from('reviews')
      .select('id,restaurant_id,author_id,rating,would_return,trust_weight')
      .eq('quarantined', false)
    if (RESTAURANT) q = q.eq('restaurant_id', RESTAURANT)
    return q.order('id', { ascending: true }).range(from, to)
  }, 'reviews')
  console.log(`[communityStats] loaded ${reviews.length} reviews`)

  // ─── 2. Recompute user_rating_stats ──────────────────────────────────────
  // Group ratings by author
  const ratingsByUser = new Map<string, number[]>()
  for (const r of reviews) {
    if (r.rating == null) continue
    if (!ratingsByUser.has(r.author_id)) ratingsByUser.set(r.author_id, [])
    ratingsByUser.get(r.author_id)!.push(r.rating)
  }

  // Population stats over all ratings (for calibration)
  const allRatings = [...ratingsByUser.values()].flat()
  const popN   = allRatings.length
  const popMu  = popN > 0 ? allRatings.reduce((s, r) => s + r, 0) / popN : MU0
  const popVar = popN > 1
    ? allRatings.reduce((s, r) => s + (r - popMu) ** 2, 0) / (popN - 1)
    : 1
  const popSigma = Math.sqrt(popVar)
  console.log(`[communityStats] pop stats: n=${popN} μ=${popMu.toFixed(3)} σ=${popSigma.toFixed(3)}`)

  // Per-user shrunk stats.
  // Both μ and σ² are shrunk toward the population with pseudo-count M_PSEUDO,
  // per §2: σ_u' = max(σ_u_shrunk, 0.75). The shrinkage is what makes the
  // calibration self-disable below ~5 ratings/user — with little history,
  // μ_u_shrunk ≈ μ_pop and σ_u_shrunk ≈ σ_pop, so calibrated ≈ raw.
  const userStats = new Map<string, { muShrunk: number; sigmaEff: number; n: number }>()
  for (const [userId, ratings] of ratingsByUser) {
    const n    = ratings.length
    const muU  = ratings.reduce((s, r) => s + r, 0) / n
    const varU = n > 1 ? ratings.reduce((s, r) => s + (r - muU) ** 2, 0) / (n - 1) : 0
    const muShrunk  = (popMu * M_PSEUDO + n * muU) / (M_PSEUDO + n)
    const varShrunk = (popVar * M_PSEUDO + n * varU) / (M_PSEUDO + n)
    const sigmaEff  = Math.max(Math.sqrt(varShrunk), SIGMA_FLOOR)
    userStats.set(userId, { muShrunk, sigmaEff, n })
  }

  if (WRITE) {
    const userRows = [...ratingsByUser.entries()].map(([userId, ratings]) => {
      const n    = ratings.length
      const muU  = ratings.reduce((s, r) => s + r, 0) / n
      const varU = n > 1 ? ratings.reduce((s, r) => s + (r - muU) ** 2, 0) / (n - 1) : 0
      return {
        user_id:     userId,
        n_ratings:   n,
        mean_rating: muU,
        stddev_rating: Math.sqrt(varU),
        computed_at: new Date().toISOString(),
      }
    })
    if (userRows.length > 0) {
      const { error: ursErr } = await sb
        .from('user_rating_stats')
        .upsert(userRows, { onConflict: 'user_id' })
      if (ursErr) console.warn('[communityStats] user_rating_stats upsert warn:', ursErr.message)
      else console.log(`[communityStats] upserted ${userRows.length} user_rating_stats rows`)
    }
  }

  // ─── 3. Build per-restaurant rating arrays (calibrated) ──────────────────
  type RatingRow = { calibrated: number; raw: number; weight: number }
  const ratingsByRestaurant = new Map<string, RatingRow[]>()
  const beenByRestaurant    = new Map<string, number>()
  const returnAskByRest     = new Map<string, number>()
  const returnYesByRest     = new Map<string, number>()

  for (const r of reviews) {
    const rid = r.restaurant_id

    // n_been: any non-quarantined review row = a "Been" signal
    beenByRestaurant.set(rid, (beenByRestaurant.get(rid) ?? 0) + 1)

    // would_return
    if (r.would_return !== null && r.would_return !== undefined) {
      returnAskByRest.set(rid, (returnAskByRest.get(rid) ?? 0) + 1)
      if (r.would_return) returnYesByRest.set(rid, (returnYesByRest.get(rid) ?? 0) + 1)
    }

    // ratings only
    if (r.rating == null) continue
    const uStats = userStats.get(r.author_id)
    // Per-rater calibration: remove user bias, rescale to pop dispersion.
    // No explicit n-gate — the pseudo-count shrinkage in userStats already
    // self-disables this for users with few ratings (§2).
    const calibrated = uStats
      ? clamp(popMu + (r.rating - uStats.muShrunk) * (popSigma / uStats.sigmaEff), 1, 10)
      : r.rating
    if (!ratingsByRestaurant.has(rid)) ratingsByRestaurant.set(rid, [])
    ratingsByRestaurant.get(rid)!.push({
      calibrated,
      raw:    r.rating,
      weight: clamp(Number(r.trust_weight) || 0.25, 0.05, 2.0), // w_i ∈ [0.05, 2.0] per §2
    })
  }

  // ─── 4. Compute Elo seeds from the algorithmic score ──────────────────────
  // There is no stored gastronome_score column — the score is computed by
  // src/lib/score.ts from the source ratings, so fetch those inputs and run
  // the same pure function the app uses. R_init = 1500 + 100*(score - 7);
  // scoreless restaurants seed at 1400 (§2).
  type RestaurantRow = {
    id: string
    google_rating: number | null
    yelp_rating: number | null
    infatuation_rating: number | null
    beli_score: number | null
    google_review_count: number | null
    yelp_review_count: number | null
    social_score: number | null
  }
  const restaurants = await fetchAll<RestaurantRow>((from, to) => {
    let q = sb
      .from('restaurants')
      .select('id,google_rating,yelp_rating,infatuation_rating,beli_score,google_review_count,yelp_review_count,social_score')
    if (RESTAURANT) q = q.eq('id', RESTAURANT)
    return q.order('id', { ascending: true }).range(from, to)
  }, 'restaurants')

  const eloSeedByRest = new Map<string, number>()
  for (const rest of restaurants) {
    const gs = gastronomeScore(rest)
    const seed = gs != null
      ? ELO_SEED_OFFSET + ELO_SEED_SCALE * (gs.score - 7)
      : ELO_DEFAULT
    eloSeedByRest.set(rest.id, seed)
  }

  // ─── 5. Load comparisons (paginated, chronological) and compute Elo ───────
  type ComparisonRow = {
    winner_id: string
    loser_id: string
    trust_weight: number | string | null
    created_at: string
  }
  const comparisons = await fetchAll<ComparisonRow>((from, to) => {
    let q = sb
      .from('restaurant_comparisons')
      .select('winner_id,loser_id,trust_weight,created_at')
    if (RESTAURANT) q = q.or(`winner_id.eq.${RESTAURANT},loser_id.eq.${RESTAURANT}`)
    return q
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }) // stable tiebreak so pages never overlap
      .range(from, to)
  }, 'restaurant_comparisons')

  // Initialize Elo from seeds
  const eloRatings     = new Map<string, number>()
  const eloMatchCounts = new Map<string, number>()
  const eloComparisons = new Map<string, number>()

  const initElo = (id: string) => {
    if (!eloRatings.has(id)) {
      eloRatings.set(id, eloSeedByRest.get(id) ?? ELO_DEFAULT)
      eloMatchCounts.set(id, 0)
      eloComparisons.set(id, 0)
    }
  }

  for (const comp of comparisons) {
    const { winner_id: w, loser_id: l, trust_weight: tw } = comp
    initElo(w)
    initElo(l)
    const rW   = eloRatings.get(w)!
    const rL   = eloRatings.get(l)!
    const nW   = eloMatchCounts.get(w)!
    const nL   = eloMatchCounts.get(l)!
    const kW   = nW < ELO_K_CUTOFF ? ELO_K_HIGH : ELO_K_LOW
    const kL   = nL < ELO_K_CUTOFF ? ELO_K_HIGH : ELO_K_LOW
    const trust = Math.max(0.05, Math.min(2.0, Number(tw) || 1.0))
    const { newW, newL } = eloUpdate(rW, rL, kW, kL, trust)
    eloRatings.set(w, newW)
    eloRatings.set(l, newL)
    eloMatchCounts.set(w, nW + 1)
    eloMatchCounts.set(l, nL + 1)
    eloComparisons.set(w, (eloComparisons.get(w) ?? 0) + 1)
    eloComparisons.set(l, (eloComparisons.get(l) ?? 0) + 1)
  }
  // TODO: nightly Bradley-Terry refinement (MM algorithm, warm-started from
  // above Elo).  Implement when comparison volume warrants (≥30 pairs).

  // ─── 6. Aggregate per restaurant ─────────────────────────────────────────
  const allRestaurantIds = new Set([
    ...beenByRestaurant.keys(),
    ...eloRatings.keys(),
  ])
  if (RESTAURANT) {
    allRestaurantIds.clear()
    allRestaurantIds.add(RESTAURANT)
  }

  const now = new Date().toISOString()
  const upsertRows: Record<string, unknown>[] = []

  for (const rid of allRestaurantIds) {
    const ratings  = ratingsByRestaurant.get(rid) ?? []
    const nBeen    = beenByRestaurant.get(rid)    ?? 0
    const nRetAsk  = returnAskByRest.get(rid)     ?? 0
    const nRetYes  = returnYesByRest.get(rid)     ?? 0
    const nRatings = ratings.length

    let meanRaw:       number | null = null
    let meanCalibrated: number | null = null
    let ciHw:          number | null = null

    if (nRatings > 0) {
      const rawVals   = ratings.map((r) => r.raw)
      const calVals   = ratings.map((r) => r.calibrated)
      const weights   = ratings.map((r) => r.weight)

      // Weighted mean raw
      const sumW   = weights.reduce((s, w) => s + w, 0)
      meanRaw = rawVals.reduce((s, v, i) => s + v * weights[i], 0) / sumW

      // Trimmed calibrated weights
      const trimmed = trimByWeightMass(calVals, weights, TRIM_FRACTION)

      if (trimmed.vals.length > 0) {
        const tSumW   = trimmed.weights.reduce((s, w) => s + w, 0)
        const tSumW2  = trimmed.weights.reduce((s, w) => s + w * w, 0)
        // Bayesian shrink: C = (μ0·K + Σ w_i·cal_i) / (K + Σ w_i)
        const numerator   = MU0 * K + trimmed.vals.reduce((s, v, i) => s + v * trimmed.weights[i], 0)
        const denominator = K + tSumW
        meanCalibrated = numerator / denominator

        // Variance for CI
        const wStats = weightedStats(trimmed.vals, trimmed.weights)
        ciHw = wStats.variance > 0 ? ciHalfwidth(wStats.variance, tSumW, tSumW2) : 0
      }
    }

    const weightedN = (ratingsByRestaurant.get(rid) ?? []).reduce((s, r) => s + r.weight, 0)
    const elo       = eloRatings.get(rid)      ?? eloSeedByRest.get(rid) ?? ELO_DEFAULT
    const nComp     = eloComparisons.get(rid)  ?? 0

    const row: Record<string, unknown> = {
      restaurant_id:   rid,
      n_been:          nBeen,
      n_return_asked:  nRetAsk,
      n_return_yes:    nRetYes,
      n_ratings:       nRatings,
      weighted_n:      weightedN,
      mean_raw:        meanRaw,
      mean_calibrated: meanCalibrated,
      ci_halfwidth:    ciHw,
      elo:             Math.round(elo * 10) / 10,
      n_comparisons:   nComp,
      computed_at:     now,
    }
    upsertRows.push(row)
  }

  console.log(`[communityStats] computed stats for ${upsertRows.length} restaurants`)

  if (!WRITE) {
    console.log('[communityStats] dry-run — first 3 rows:')
    console.log(JSON.stringify(upsertRows.slice(0, 3), null, 2))
    console.log('[communityStats] done (no writes).')
    return
  }

  // UPSERT in batches of 500 (never truncate — landmine protection)
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const batch = upsertRows.slice(i, i + BATCH)
    const { error } = await sb
      .from('restaurant_community_stats')
      .upsert(batch, { onConflict: 'restaurant_id' })
    if (error) {
      console.error(`[communityStats] upsert error batch ${i / BATCH}:`, error.message)
      process.exit(1)
    }
    upserted += batch.length
  }
  console.log(`[communityStats] upserted ${upserted} rows into restaurant_community_stats.`)
}

main().catch((e) => {
  console.error('[communityStats] crashed:', e)
  process.exit(1)
})
