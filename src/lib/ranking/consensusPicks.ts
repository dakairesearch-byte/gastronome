/**
 * Consensus Picks v2 — restaurants where Google, Yelp, TikTok, and Instagram
 * all converge.
 *
 * The naive v1 was a binary "all three review sources non-null" filter. v2
 * is a real composite score over four normalized signals:
 *
 *   - Google rating  → 30%   (rating / 5)
 *   - Yelp rating    → 30%   (rating / 5)
 *   - TikTok signal  → 20%   log-normalized (view_count + like_count) sum
 *   - Instagram      → 20%   log-normalized like_count sum
 *
 * IG `view_count` is unreliable in our data — most rows are 0 because
 * the IG public-page scrape doesn't expose view metrics consistently. So
 * we use likes only for IG, and combine views+likes for TikTok where both
 * are populated.
 *
 * Quality floor: google_rating >= 4.2, yelp_rating >= 4.0, AND the
 * restaurant must have at least one TikTok video AND at least one
 * Instagram video. Restaurants below the floor or missing either platform
 * are excluded entirely — the floor is the "is this place good?" gate
 * before the social-attention re-ranking kicks in.
 *
 * Normalization is per-city: TikTok and Instagram engagement scales vary
 * dramatically across cities (NYC noise floor >> Boise ceiling), so we
 * scale each city against its own max. Within a city, the result is
 * comparable; across cities, scores aren't.
 *
 * Returns up to `limit` (default 20) Restaurant rows ordered by
 * consensus_score descending.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Restaurant } from '@/types/database'

interface SocialAggregate {
  restaurant_id: string
  tiktok_eng: number
  ig_eng: number
}

interface TopConsensusOpts {
  city: string
  limit?: number
}

/**
 * Pull all restaurant_videos rows for the given city's restaurants in
 * pages of 1000 (Supabase hard cap), aggregate per restaurant_id, and
 * return only restaurants that have at least one row on BOTH platforms.
 */
async function aggregateSocialSignals(
  supabase: SupabaseClient<Database>,
  restaurantIdsInCity: Set<string>,
): Promise<Map<string, SocialAggregate>> {
  // Pull video rows in pages, gated to restaurants in the active city so
  // we don't fetch global IG/TT rows we'll discard. The `.in()` filter
  // accepts up to a few thousand IDs — well above any single-city size.
  const ids = Array.from(restaurantIdsInCity)
  const aggregates = new Map<
    string,
    { tiktok_eng: number; ig_eng: number; has_tt: boolean; has_ig: boolean }
  >()
  // Supabase hard-caps single .select() rows at 1000; paginate via .range
  // so we don't silently truncate a hot city's video pool.
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('restaurant_videos')
      .select('restaurant_id, platform, view_count, like_count')
      .in('restaurant_id', ids)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`consensus social aggregate: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data as Array<{
      restaurant_id: string
      platform: string
      view_count: number | null
      like_count: number | null
    }>) {
      let agg = aggregates.get(row.restaurant_id)
      if (!agg) {
        agg = { tiktok_eng: 0, ig_eng: 0, has_tt: false, has_ig: false }
        aggregates.set(row.restaurant_id, agg)
      }
      const views = Number(row.view_count) || 0
      const likes = Number(row.like_count) || 0
      if (row.platform === 'tiktok') {
        // TikTok: views + likes. View_count is reliable on TT.
        agg.tiktok_eng += views + likes
        agg.has_tt = true
      } else if (row.platform === 'instagram') {
        // Instagram: likes only. view_count is mostly 0 in our scrape;
        // including it would just add noise weighted toward whichever
        // accounts happen to have public reels.
        agg.ig_eng += likes
        agg.has_ig = true
      }
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  // Drop restaurants missing either platform — they don't qualify for
  // "consensus across all four signals" by definition.
  const result = new Map<string, SocialAggregate>()
  for (const [restaurant_id, agg] of aggregates) {
    if (agg.has_tt && agg.has_ig) {
      result.set(restaurant_id, {
        restaurant_id,
        tiktok_eng: agg.tiktok_eng,
        ig_eng: agg.ig_eng,
      })
    }
  }
  return result
}

export async function topConsensusPicks(
  supabase: SupabaseClient<Database>,
  opts: TopConsensusOpts,
): Promise<Restaurant[]> {
  const limit = opts.limit ?? 20
  const city = opts.city

  // Step 1 — pull the restaurants that meet the quality floor in this city.
  // We keep this as the primary query and treat the social aggregates as a
  // secondary filter rather than the other way round, because cities have
  // hundreds of qualifying restaurants but tens of thousands of videos
  // globally — narrowing first by city + rating is the cheaper join.
  const { data: candidates, error: candidatesErr } = await supabase
    .from('restaurants')
    .select('*')
    .ilike('city', city)
    .gte('google_rating', 4.2)
    .gte('yelp_rating', 4.0)
    // Pull a generous slice — Supabase caps each query at 1000, and
    // realistic cities have well under 500 restaurants meeting the
    // rating floor. If a city ever exceeds the cap, paginate here.
    .limit(1000)
  if (candidatesErr) {
    throw new Error(`consensus candidates: ${candidatesErr.message}`)
  }
  const candidateRows = (candidates ?? []) as Restaurant[]
  if (candidateRows.length === 0) return []

  // Step 2 — aggregate TikTok + Instagram engagement for the candidate set.
  const candidateIds = new Set(candidateRows.map((r) => r.id))
  const social = await aggregateSocialSignals(supabase, candidateIds)
  if (social.size === 0) return []

  // Step 3 — compute per-city normalization bounds.
  let maxTT = 0
  let maxIG = 0
  for (const agg of social.values()) {
    if (agg.tiktok_eng > maxTT) maxTT = agg.tiktok_eng
    if (agg.ig_eng > maxIG) maxIG = agg.ig_eng
  }
  // Log scale: ln(1+x) / ln(1+max). Guards against max=0 (would div by 0)
  // and against a single dominant outlier flattening every other entry —
  // log compresses the long tail so a 100k-view restaurant doesn't make a
  // 10k-view restaurant look like noise.
  const ttDenom = Math.log(1 + maxTT)
  const igDenom = Math.log(1 + maxIG)
  const normalize = (value: number, denom: number) =>
    denom > 0 ? Math.log(1 + value) / denom : 0

  // Step 4 — score and sort.
  type Scored = { row: Restaurant; score: number }
  const scored: Scored[] = []
  for (const r of candidateRows) {
    const agg = social.get(r.id)
    if (!agg) continue // missing one platform — disqualified by floor
    const google = (r.google_rating ?? 0) / 5
    const yelp = (r.yelp_rating ?? 0) / 5
    const tt = normalize(agg.tiktok_eng, ttDenom)
    const ig = normalize(agg.ig_eng, igDenom)
    const score = 0.3 * google + 0.3 * yelp + 0.2 * tt + 0.2 * ig
    scored.push({ row: r, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.row)
}
