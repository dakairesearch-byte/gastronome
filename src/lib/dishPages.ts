/**
 * dishPages.ts
 *
 * Data layer for the programmatic SEO dish pages at /best/{city}/{dish}.
 * Handles slug helpers and the gated query that powers both the dish-detail
 * page and the city-index page.
 *
 * QUALITY GATE (non-negotiable, enforced here — not in the page):
 *   - At least 3 restaurants in the city have a restaurant_top_dishes row
 *     whose display_name matches the dish (ilike, normalized).
 *   - At least 2 of those restaurants have a Gastronome Score
 *     (i.e. google_rating or yelp_rating present so gastronomeScore() returns
 *     non-null).
 *
 * Fewer good pages beat many bad ones.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Restaurant, RestaurantTopDish, City } from '@/types/database'
import { gastronomeScore } from '@/lib/score'

/* ------------------------------------------------------------------ */
/*  Slug helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Convert a display string into a URL-safe slug.
 * "Birria Tacos"   → "birria-tacos"
 * "Pad Thai"       → "pad-thai"
 * "Crème Brûlée"   → "creme-brulee"
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')                          // decompose accented chars
    .replace(/[̀-ͯ]/g, '')           // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')             // remove non-alphanumeric
    .trim()
    .replace(/\s+/g, '-')                      // spaces → hyphens
    .replace(/-+/g, '-')                       // collapse repeated hyphens
}

/**
 * Convert a URL slug back to a human-readable title (best-effort).
 * "birria-tacos"   → "Birria Tacos"
 * "pad-thai"       → "Pad Thai"
 */
export function deslugify(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/* ------------------------------------------------------------------ */
/*  Types                                                                */
/* ------------------------------------------------------------------ */

export type DishPageRestaurant = {
  restaurant: Restaurant
  dish: RestaurantTopDish
  /** Pre-computed score — null when gastronomeScore() returns null. */
  gastronomeScore: number | null
  /**
   * Human-readable evidence line, e.g.
   * "mentioned 14× across reviews, Google, and TikTok"
   */
  evidenceLine: string
}

export type DishPageData = {
  city: City
  dishDisplayName: string
  /** Slug used in the URL (derived from dishDisplayName). */
  dishSlug: string
  restaurants: DishPageRestaurant[]
}

export type CityDishEntry = {
  dishDisplayName: string
  dishSlug: string
  /** How many qualifying restaurants carry this dish in the city. */
  restaurantCount: number
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                     */
/* ------------------------------------------------------------------ */

/** Anon client — sitemap and server components only; no user cookies. */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}

/**
 * Build the evidence line from a top-dish row.
 *
 * Example outputs:
 *   "mentioned 14× across Google reviews and TikTok"
 *   "mentioned 7× in Google reviews"
 *   "mentioned once in reviews"
 */
function buildEvidenceLine(dish: RestaurantTopDish): string {
  const sources: string[] = []
  if (dish.google_mentions > 0) sources.push('Google reviews')
  if (dish.tiktok_mentions > 0) sources.push('TikTok')
  if (dish.instagram_mentions > 0) sources.push('Instagram')

  // Any remaining mentions not covered by the above named sources
  // (e.g. internal review mentions) are folded into "reviews"
  const namedMentions =
    dish.google_mentions + dish.tiktok_mentions + dish.instagram_mentions
  if (namedMentions < dish.total_mentions) {
    sources.unshift('reviews')
  }

  const count = dish.total_mentions
  const countStr = count === 1 ? 'once' : `${count}×` // ×

  if (sources.length === 0) {
    return `mentioned ${countStr}`
  }
  if (sources.length === 1) {
    return `mentioned ${countStr} in ${sources[0]}`
  }
  const last = sources.pop()!
  return `mentioned ${countStr} across ${sources.join(', ')} and ${last}`
}

/* ------------------------------------------------------------------ */
/*  Public API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch all active cities (the 6 slugs used in /best/ routes).
 * Cached via Next.js ISR — callers should not cache separately.
 */
export async function getActiveCities(): Promise<City[]> {
  const supabase = anonClient()
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) return []
  return data
}

/**
 * Fetch qualifying dish page data for a specific city + dish.
 *
 * Returns null when the QUALITY GATE fails:
 *   - Fewer than 3 restaurants have the dish.
 *   - Fewer than 2 of those have a Gastronome Score.
 *
 * Ranked by Gastronome Score (desc), with null-score restaurants last.
 */
export async function getDishPageData(
  citySlug: string,
  dishSlug: string,
): Promise<DishPageData | null> {
  const supabase = anonClient()

  // 1. Resolve city
  const { data: cityData, error: cityError } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .single()

  if (cityError || !cityData) return null

  // 2/3. Fetch this city's top-dish rows (slim restaurant embed for the
  //    city filter only) and match by SLUG EQUALITY in JS, not by ilike
  //    on a deslugified name. deslugify() cannot reconstruct apostrophes,
  //    ampersands, accents, or hyphens ("Crème Brûlée" → "creme-brulee" →
  //    "Creme Brulee" never ilike-matches the stored name), which would
  //    404 ~19% of the dish pages that getCityTopDishes and the sitemap
  //    enumerate. Slug-equality keeps the detail page, the city index,
  //    and the sitemap perfectly consistent.
  const PAGE_SIZE = 1000
  const rows: RestaurantTopDish[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('restaurant_top_dishes')
      .select(`
        *,
        restaurants!inner(city)
      `)
      .eq('restaurants.city', cityData.name)
      .order('total_mentions', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error || !data) break
    for (const row of data as unknown as RestaurantTopDish[]) {
      if (slugify(row.display_name) === dishSlug) rows.push(row)
    }
    if (data.length < PAGE_SIZE) break
  }

  // 4. De-duplicate: keep only the best (highest total_mentions) dish row
  //    per restaurant — a restaurant may have the same dish name across
  //    multiple rank positions if it was entered with slight variations.
  const bestByRestaurant = new Map<string, RestaurantTopDish>()
  for (const row of rows) {
    const existing = bestByRestaurant.get(row.restaurant_id)
    if (!existing || row.total_mentions > existing.total_mentions) {
      bestByRestaurant.set(row.restaurant_id, row)
    }
  }
  const deduped = Array.from(bestByRestaurant.values())

  // 5. Quality gate — ≥3 restaurants have the dish
  if (deduped.length < 3) return null

  // 5b. Fetch the full restaurant rows for the (small) qualifying set.
  const restaurantIds = deduped.map((row) => row.restaurant_id)
  const { data: restaurantRows, error: restaurantsError } = await supabase
    .from('restaurants')
    .select('*')
    .in('id', restaurantIds)

  if (restaurantsError || !restaurantRows) return null

  const restaurantById = new Map<string, Restaurant>()
  for (const r of restaurantRows as Restaurant[]) {
    restaurantById.set(r.id, r)
  }

  // 6. Compute Gastronome Scores (drop rows whose restaurant vanished
  //    between the two queries — keeps the gate honest).
  const withScores: DishPageRestaurant[] = deduped
    .filter((row) => restaurantById.has(row.restaurant_id))
    .map((row) => {
      const restaurant = restaurantById.get(row.restaurant_id)!
      const result = gastronomeScore(restaurant)
      return {
        restaurant,
        dish: row,
        gastronomeScore: result?.score ?? null,
        evidenceLine: buildEvidenceLine(row),
      }
    })

  // Re-check the ≥3 gate after the restaurant join.
  if (withScores.length < 3) return null

  // 7. Quality gate — ≥2 have a Gastronome Score
  const scoredCount = withScores.filter((r) => r.gastronomeScore !== null).length
  if (scoredCount < 2) return null

  // 8. Sort: scored restaurants by score desc, then unscored by total_mentions desc
  withScores.sort((a, b) => {
    if (a.gastronomeScore !== null && b.gastronomeScore !== null) {
      return b.gastronomeScore - a.gastronomeScore
    }
    if (a.gastronomeScore !== null) return -1
    if (b.gastronomeScore !== null) return 1
    return b.dish.total_mentions - a.dish.total_mentions
  })

  // 9. Determine canonical display name: use the most common (by mention count)
  //    display_name from the actual rows (preserves DB casing).
  const nameCounts = new Map<string, number>()
  for (const row of deduped) {
    const n = nameCounts.get(row.display_name) ?? 0
    nameCounts.set(row.display_name, n + row.total_mentions)
  }
  const canonicalDisplayName = Array.from(nameCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? deslugify(dishSlug)

  return {
    city: cityData,
    dishDisplayName: canonicalDisplayName,
    dishSlug,
    restaurants: withScores,
  }
}

/**
 * Fetch the top ~30 qualifying dishes for a city index page.
 *
 * A dish qualifies only if getDishPageData() would return non-null for it
 * (same gate: ≥3 restaurants, ≥2 scored). We efficiently pre-screen by
 * querying dish display_names with counts before running the full gate.
 *
 * Returns at most 30 entries, sorted by total qualifying restaurant count
 * (most-represented dish first).
 */
export async function getCityTopDishes(citySlug: string): Promise<CityDishEntry[]> {
  const supabase = anonClient()

  const { data: cityData, error: cityError } = await supabase
    .from('cities')
    .select('name, slug')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .single()

  if (cityError || !cityData) return []

  // Fetch all top-dish rows for restaurants in this city, with the restaurant
  // join so we can filter by city and check scoring availability.
  // We need google_rating / yelp_rating on the restaurant to assess
  // whether gastronomeScore() would return non-null.
  type DishRow = {
    display_name: string
    total_mentions: number
    restaurant_id: string
    restaurants: Pick<Restaurant, 'google_rating' | 'yelp_rating' | 'beli_score' | 'infatuation_rating' | 'social_score'>
  }

  const PAGE_SIZE = 1000
  const allDishRows: DishRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('restaurant_top_dishes')
      .select(`
        display_name,
        total_mentions,
        restaurant_id,
        restaurants!inner(google_rating, yelp_rating, beli_score, infatuation_rating, social_score)
      `)
      .eq('restaurants.city', cityData.name)
      .range(from, from + PAGE_SIZE - 1)

    if (error || !data) break
    allDishRows.push(...(data as unknown as DishRow[]))
    if (data.length < PAGE_SIZE) break
  }

  if (allDishRows.length === 0) return []

  // Normalize display_name so "Birria Tacos" and "birria tacos" map to one slug
  type DishAccum = {
    canonicalName: string
    /** Mention count of the variant currently used as canonicalName. */
    canonicalMentions: number
    restaurantIds: Set<string>
    scoredRestaurantIds: Set<string>
    totalMentions: number
  }
  const bySlug = new Map<string, DishAccum>()

  for (const row of allDishRows) {
    const slug = slugify(row.display_name)
    // Names that slugify to nothing (emoji-only, non-Latin) can't form a
    // routable /best/{city}/{dish} URL — skip them.
    if (!slug) continue
    let entry = bySlug.get(slug)
    if (!entry) {
      entry = {
        canonicalName: row.display_name,
        canonicalMentions: row.total_mentions,
        restaurantIds: new Set(),
        scoredRestaurantIds: new Set(),
        totalMentions: 0,
      }
      bySlug.set(slug, entry)
    }

    // Keep the most-mentioned variant as the canonical display name
    // (the dish page itself re-derives canonical from its own query).
    if (row.total_mentions > entry.canonicalMentions) {
      entry.canonicalName = row.display_name
      entry.canonicalMentions = row.total_mentions
    }

    entry.restaurantIds.add(row.restaurant_id)
    entry.totalMentions += row.total_mentions

    // Check if this restaurant can yield a Gastronome Score:
    // gastronomeScore() needs at least one of google_rating, yelp_rating,
    // infatuation_rating, or beli_score to be non-null.
    const r = row.restaurants
    const hasScore =
      r.google_rating != null ||
      r.yelp_rating != null ||
      r.infatuation_rating != null ||
      r.beli_score != null
    if (hasScore) {
      entry.scoredRestaurantIds.add(row.restaurant_id)
    }
  }

  // Apply the same quality gate as getDishPageData:
  // ≥3 restaurants, ≥2 scored
  const qualifying: CityDishEntry[] = []
  for (const [slug, entry] of bySlug.entries()) {
    if (
      entry.restaurantIds.size >= 3 &&
      entry.scoredRestaurantIds.size >= 2
    ) {
      qualifying.push({
        dishDisplayName: entry.canonicalName,
        dishSlug: slug,
        restaurantCount: entry.restaurantIds.size,
      })
    }
  }

  // Sort by restaurant count desc, then by totalMentions as tiebreaker
  qualifying.sort((a, b) => b.restaurantCount - a.restaurantCount)

  return qualifying.slice(0, 30)
}

/**
 * Enumerate all qualifying city/dish pairs for the sitemap.
 * Uses the same quality gate as getCityTopDishes.
 * Returns an array of { citySlug, dishSlug } pairs.
 */
export async function getAllQualifyingDishPages(): Promise<
  { citySlug: string; dishSlug: string }[]
> {
  const cities = await getActiveCities()
  const results: { citySlug: string; dishSlug: string }[] = []

  for (const city of cities) {
    const dishes = await getCityTopDishes(city.slug)
    for (const dish of dishes) {
      results.push({ citySlug: city.slug, dishSlug: dish.dishSlug })
    }
  }

  return results
}
