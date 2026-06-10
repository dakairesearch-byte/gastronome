'use client'

/**
 * useDiscoverResults — the SINGLE data engine behind /discover.
 *
 * Wave-2 DISCOVER MERGE extraction: the restaurant query, dish query, and
 * neighborhood facet that previously lived inline in src/app/search/page.tsx
 * are ported here verbatim so the new /discover assembler (and its
 * List/Map/Grid views) can share one filtered result set instead of the two
 * parallel implementations Explore + Search used to maintain.
 *
 * The logic is a faithful 1:1 extraction — case-insensitive city/neighborhood
 * ilike clauses, the Michelin stars ∪ Bib Gourmand union follow-up, every
 * rating/review/accolade predicate, RESULT_CAP, the client-side
 * gastronome-score sort, and the restaurant_top_dishes → highlighted_dishes
 * dish path (one collapsed row per restaurant, tier + mentions). Behavior is
 * preserved; nothing about the query semantics changes.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { gastronomeScore } from '@/lib/score'
import type { Restaurant } from '@/types/database'
import type { SearchFilters } from '@/components/search/SearchFiltersSidebar'

/* ------------------------------------------------------------------ */
/*  Public contract types                                              */
/* ------------------------------------------------------------------ */

/**
 * Sort axis for the restaurant result set. Mirrors the union previously
 * defined privately in src/app/search/page.tsx (not exported there).
 *  - 'gastronome' — computed Gastronome Score (client-side); the default.
 *  - 'google'     — google_rating desc.
 *  - 'count'      — google_review_count desc.
 *  - 'name'       — name A→Z.
 */
export type SortKey = 'gastronome' | 'google' | 'count' | 'name'

/**
 * One dish hit, collapsed to the strongest matching dish per restaurant.
 * Ported from the inline DishHit interface in search/page.tsx.
 */
export interface DishHit {
  dish_name: string
  /** Cross-source mention total backing the dish (total_mentions). */
  mention_count: number
  /** Quality tier from restaurant_top_dishes (e.g. "must_order"); null for
   *  the noisier highlighted-dishes fallback. */
  tier: string | null
  /** True when this hit is the restaurant's single strongest matching dish
   *  (top_dishes path). Drives the "Top dish" signal. */
  isTopDish: boolean
  restaurant: Restaurant
}

export interface DiscoverResultsArgs {
  filters: SearchFilters
  sort: SortKey
  query: string
}

export interface DiscoverResults {
  restaurants: Restaurant[]
  dishes: DishHit[]
  /** Distinct neighborhood facet, scoped to the selected city/cities. */
  neighborhoods: string[]
  loading: boolean
  /** Canonical result total: restaurants + dishes (matches the page's
   *  totalResults so header summaries and CTAs can never disagree). */
  total: number
}

/* ------------------------------------------------------------------ */
/*  Result-cap config                                                  */
/* ------------------------------------------------------------------ */

// Hard server-side cap on restaurant rows per query. Results beyond this are
// not fetched; the UI says so plainly instead of faking "M+" / infinite
// scroll. Raising this is a query-cost decision, not a UI tweak.
export const RESULT_CAP = 40

/* ------------------------------------------------------------------ */
/*  Query-building helpers (ported verbatim from search/page.tsx)      */
/* ------------------------------------------------------------------ */

/**
 * Build a case-insensitive PostgREST `.or()` clause matching `city` against
 * any of the selected city names (whole-value `ilike`, no wildcards). Used
 * so restaurants.city values with casing/typo drift ('new york') still
 * match a 'New York' facet selection.
 */
function cityIlikeClause(cities: string[]): string {
  return cities
    .map((c) => `city.ilike.${c.replace(/[%_\\]/g, '')}`)
    .join(',')
}

/**
 * Whole-value, case-insensitive `.or()` clause matching `neighborhood`
 * against any selected neighborhood name. Same rationale as
 * cityIlikeClause: restaurants.neighborhood has casing drift, so an exact
 * `.in()` would silently drop rows. Wildcards are stripped so the value is
 * matched whole (no user-controlled `%`/`_`).
 */
function neighborhoodIlikeClause(neighborhoods: string[]): string {
  return neighborhoods
    .map((n) => `neighborhood.ilike.${n.replace(/[%_\\]/g, '')}`)
    .join(',')
}

/**
 * Minimal structural type for the PostgREST builder methods we need to apply
 * a server-side order. Avoids importing the full generic builder type.
 */
interface OrderableQuery<T> {
  order(
    column: string,
    options: { ascending: boolean; nullsFirst: boolean }
  ): T
  limit(count: number): T
}

/**
 * Apply server-side ordering for the column-backed sort keys. The
 * 'gastronome' default has no stored column, so it falls back to a
 * quality-biased fetch (google_rating desc) — the final score-based order is
 * applied client-side in sortRestaurants once the full slice is in hand.
 */
function applyServerSort<T extends OrderableQuery<T>>(query: T, sort: SortKey): T {
  if (sort === 'name') {
    return query.order('name', { ascending: true, nullsFirst: false })
  }
  if (sort === 'count') {
    return query
      .order('google_review_count', { ascending: false, nullsFirst: false })
      .order('google_rating', { ascending: false, nullsFirst: false })
  }
  // 'google' and 'gastronome' both seed from google_rating; 'gastronome' is
  // then re-sorted by computed score client-side.
  return query
    .order('google_rating', { ascending: false, nullsFirst: false })
    .order('google_review_count', { ascending: false, nullsFirst: false })
}

/**
 * Authoritative client-side sort over the fetched restaurant slice. Required
 * for 'gastronome' (computed score) and to re-order the bib-union merge for
 * the other keys. Returns a new array; does not mutate the input.
 */
function sortRestaurants(rows: Restaurant[], sort: SortKey): Restaurant[] {
  const sorted = rows.slice()
  if (sort === 'name') {
    sorted.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  } else if (sort === 'count') {
    sorted.sort(
      (a, b) => (b.google_review_count ?? 0) - (a.google_review_count ?? 0)
    )
  } else if (sort === 'google') {
    sorted.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
  } else {
    // gastronome: rows with no rating source (null score) sink to the bottom.
    sorted.sort((a, b) => {
      const sa = gastronomeScore(a)?.score ?? -1
      const sb = gastronomeScore(b)?.score ?? -1
      return sb - sa
    })
  }
  return sorted
}

/**
 * Check whether a restaurant passes the active filter set. Used for
 * post-filtering dish results (we can't push every predicate through the
 * joined select in a single query).
 */
function matchesFilters(r: Restaurant, f: SearchFilters): boolean {
  if (f.cities.length && !f.cities.some((c) => c.toLowerCase() === r.city?.toLowerCase()))
    return false
  if (
    f.neighborhoods.length &&
    !f.neighborhoods.some((n) => n.toLowerCase() === r.neighborhood?.toLowerCase())
  )
    return false
  if (f.cuisines.length && !f.cuisines.includes(r.cuisine ?? '')) return false
  if (f.googleMinRating > 0 && (r.google_rating ?? 0) < f.googleMinRating)
    return false
  if (f.googleMinReviews > 0 && (r.google_review_count ?? 0) < f.googleMinReviews)
    return false
  if (f.yelpMinRating > 0 && (r.yelp_rating ?? 0) < f.yelpMinRating) return false
  if (f.yelpMinReviews > 0 && (r.yelp_review_count ?? 0) < f.yelpMinReviews)
    return false
  const starsOk = f.michelinStars.length
    ? f.michelinStars.includes(r.michelin_stars ?? 0)
    : false
  const bibOk = f.bibGourmand ? r.michelin_designation === 'bib_gourmand' : false
  if (f.michelinStars.length || f.bibGourmand) {
    if (!starsOk && !bibOk) return false
  }
  // Only 'winner' filters on JBF; 'nominee' is coerced to 'any' upstream
  // in filterState, so it never reaches here.
  if (f.jamesBeard === 'winner' && !r.james_beard_winner) return false
  if (f.eater38 && !r.eater_38) return false
  return true
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * The single Discover data engine. Given the active filters, sort axis, and
 * free-text query, returns the restaurant slice, the collapsed dish hits, the
 * neighborhood facet (scoped to selected cities), a loading flag, and the
 * canonical total. The 300ms debounce on the main search and the neighborhood
 * city-scoping are both ported from the original page.
 */
export default function useDiscoverResults(
  args: DiscoverResultsArgs
): DiscoverResults {
  const { filters, sort, query } = args
  // createClient() is cheap and returns a singleton client; we hold it in
  // state so its identity stays stable across renders (matching the page,
  // which captured it once via createClient() at component scope).
  const [supabase] = useState(() => createClient())

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [dishes, setDishes] = useState<DishHit[]>([])
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  /* ----------------------------------------------------------------- */
  /*  Neighborhood facet — distinct neighborhoods, scoped to the        */
  /*  selected city/cities so the list stays relevant. Re-runs whenever */
  /*  the city selection changes. neighborhood lives on restaurants.    */
  /* ----------------------------------------------------------------- */

  // Serialize the city selection so the effect dep is a stable primitive
  // (the cities array identity changes on every filter spread).
  const cityKey = filters.cities.join('|')

  useEffect(() => {
    let cancelled = false
    async function loadNeighborhoods() {
      const cities = cityKey ? cityKey.split('|').filter(Boolean) : []
      let nq = supabase
        .from('restaurants')
        .select('neighborhood')
        .not('neighborhood', 'is', null)
        .limit(2000)
      if (cities.length) {
        nq = nq.or(cityIlikeClause(cities))
      }
      const { data } = await nq
      if (cancelled) return
      const names = [
        ...new Set(
          (data ?? [])
            .map((r) => (r.neighborhood ?? '').trim())
            .filter(Boolean)
        ),
      ].sort() as string[]
      setNeighborhoods(names)
    }
    loadNeighborhoods()
    return () => {
      cancelled = true
    }
  }, [supabase, cityKey])

  /* ----------------------------------------------------------------- */
  /*  Main search — applies query + every filter in `filters`           */
  /* ----------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false
    const performSearch = async () => {
      setLoading(true)
      try {
        const wantRestaurants = filters.mode !== 'dishes'
        const wantDishes = filters.mode !== 'restaurants'

        /* -------------------- restaurant query -------------------- */
        let restaurantData: Restaurant[] = []
        if (wantRestaurants) {
          let rq = supabase.from('restaurants').select('*')

          if (query.trim()) {
            const sanitized = query.replace(/[%_\\]/g, '')
            rq = rq.or(
              `name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%,city.ilike.%${sanitized}%,neighborhood.ilike.%${sanitized}%`
            )
          }
          if (filters.cities.length) {
            // Case-insensitive city match. `.in('city', …)` is an exact,
            // case-SENSITIVE equality check, so a restaurant stored as
            // 'new york' (typo/casing drift in restaurants.city) silently
            // dropped out when the facet value was 'New York'. Use an OR of
            // per-city `ilike` clauses (no % wildcards = whole-value match,
            // just case-insensitive) to align with the dish post-filter
            // which lowercases both sides.
            rq = rq.or(cityIlikeClause(filters.cities))
          }
          if (filters.neighborhoods.length) {
            // Same whole-value, case-insensitive match as city — neighborhood
            // has the same casing drift on restaurants.neighborhood.
            rq = rq.or(neighborhoodIlikeClause(filters.neighborhoods))
          }
          if (filters.cuisines.length) {
            rq = rq.in('cuisine', filters.cuisines)
          }
          if (filters.googleMinRating > 0) {
            rq = rq.gte('google_rating', filters.googleMinRating)
          }
          if (filters.googleMinReviews > 0) {
            rq = rq.gte('google_review_count', filters.googleMinReviews)
          }
          if (filters.yelpMinRating > 0) {
            rq = rq.gte('yelp_rating', filters.yelpMinRating)
          }
          if (filters.yelpMinReviews > 0) {
            rq = rq.gte('yelp_review_count', filters.yelpMinReviews)
          }
          // Michelin: stars OR bib gourmand. Stars use .in() since it's a
          // discrete set; bib is its own designation. If both are enabled
          // we can't express the union cleanly in a single chained query,
          // so we post-filter.
          if (filters.michelinStars.length) {
            rq = rq.in('michelin_stars', filters.michelinStars)
          }
          if (filters.bibGourmand && !filters.michelinStars.length) {
            rq = rq.eq('michelin_designation', 'bib_gourmand')
          }
          if (filters.jamesBeard === 'winner') {
            // Only 'winner' is a real value now — filterState coerces the
            // legacy 'nominee' value to 'any', so there's no nominee branch
            // to silently map onto winners.
            rq = rq.eq('james_beard_winner', true)
          }
          if (filters.eater38) {
            rq = rq.eq('eater_38', true)
          }

          // Server-side ordering for the column-backed sort keys. The
          // 'gastronome' default has no stored column to .order() on, so we
          // fetch by google_rating (the highest-weight present proxy) to pull
          // a quality-biased slice, then re-sort by the computed score below.
          const { data } = await applyServerSort(rq, sort).limit(RESULT_CAP)
          restaurantData = (data ?? []) as Restaurant[]

          // Union of Michelin stars + bib gourmand requires a follow-up
          // query since we can't AND/OR these in a single chain.
          if (filters.michelinStars.length && filters.bibGourmand) {
            let bq = supabase
              .from('restaurants')
              .select('*')
              .eq('michelin_designation', 'bib_gourmand')
            if (query.trim()) {
              const sanitized = query.replace(/[%_\\]/g, '')
              bq = bq.or(
                `name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%,city.ilike.%${sanitized}%,neighborhood.ilike.%${sanitized}%`
              )
            }
            if (filters.cities.length) bq = bq.or(cityIlikeClause(filters.cities))
            if (filters.neighborhoods.length)
              bq = bq.or(neighborhoodIlikeClause(filters.neighborhoods))
            if (filters.cuisines.length) bq = bq.in('cuisine', filters.cuisines)
            if (filters.googleMinRating > 0)
              bq = bq.gte('google_rating', filters.googleMinRating)
            if (filters.googleMinReviews > 0)
              bq = bq.gte('google_review_count', filters.googleMinReviews)
            if (filters.yelpMinRating > 0)
              bq = bq.gte('yelp_rating', filters.yelpMinRating)
            if (filters.yelpMinReviews > 0)
              bq = bq.gte('yelp_review_count', filters.yelpMinReviews)
            if (filters.jamesBeard === 'winner')
              bq = bq.eq('james_beard_winner', true)
            if (filters.eater38) bq = bq.eq('eater_38', true)
            const { data: bibRows } = await applyServerSort(bq, sort).limit(RESULT_CAP)
            const seen = new Set(restaurantData.map((r) => r.id))
            for (const row of (bibRows ?? []) as Restaurant[]) {
              if (!seen.has(row.id)) {
                restaurantData.push(row)
                seen.add(row.id)
              }
            }
          }
        }

        // Final client-side sort. For 'gastronome' this is the authoritative
        // ordering (the score is computed, not stored). For the other keys it
        // re-establishes order across the bib-union merge (which appends rows
        // out of order). Stable and idempotent for the no-union case.
        restaurantData = sortRestaurants(restaurantData, sort)

        if (cancelled) return
        setRestaurants(restaurantData)

        /* -------------------- dish query -------------------- */
        // Primary source is restaurant_top_dishes (ranked, scored, with
        // cross-source mention totals) — far cleaner than the noisier
        // restaurant_highlighted_dishes, which we keep only as a no-hit
        // fallback. We collapse to ONE row per restaurant (its strongest
        // matching dish) so a single spot doesn't flood the list with every
        // dish whose name happens to contain the term.
        let dishResults: DishHit[] = []
        if (wantDishes && (query.trim() || filters.mode === 'dishes')) {
          const sanitized = query.replace(/[%_\\]/g, '')

          // ilike BEFORE limit so the cap selects from matching dishes, not a
          // top-40 prefix that's then filtered down to nothing.
          // NOTE: the live column is display_name (dish_name does not exist on
          // restaurant_top_dishes) — selecting dish_name 42703s and silently
          // dropped this whole branch to the fallback.
          let tdq = supabase
            .from('restaurant_top_dishes')
            .select(
              'display_name, score, tier, total_mentions, restaurant:restaurants(*)'
            )
            .order('score', { ascending: false, nullsFirst: false })
            .limit(60)
          if (sanitized.trim()) {
            tdq = tdq.ilike('display_name', `%${sanitized}%`)
          }
          const { data: topRows, error: topErr } = await tdq

          const collapse = (
            rows: Array<{
              dish_name: string
              mention_count: number
              tier: string | null
              isTopDish: boolean
              restaurant: Restaurant
            }>
          ): DishHit[] => {
            // First matching row per restaurant wins. Rows arrive score-desc
            // (top_dishes) / mention-desc (fallback), so the first kept row is
            // the restaurant's strongest matching dish.
            const seen = new Set<string>()
            const out: DishHit[] = []
            for (const d of rows) {
              if (!matchesFilters(d.restaurant, filters)) continue
              if (seen.has(d.restaurant.id)) continue
              seen.add(d.restaurant.id)
              out.push(d)
            }
            return out
          }

          if (!topErr && topRows && topRows.length > 0) {
            const raw = (topRows as unknown as Array<{
              display_name: string
              score: number | null
              tier: string | null
              total_mentions: number | null
              restaurant: Restaurant | null
            }>)
              .filter(
                (
                  d
                ): d is {
                  display_name: string
                  score: number | null
                  tier: string | null
                  total_mentions: number | null
                  restaurant: Restaurant
                } => !!d.restaurant
              )
              .map((d) => ({
                dish_name: d.display_name,
                mention_count: d.total_mentions ?? 0,
                tier: d.tier,
                isTopDish: true,
                restaurant: d.restaurant,
              }))
            dishResults = collapse(raw).slice(0, 12)
          } else {
            // Fallback: highlighted_dishes (no tier/score, mention-ranked).
            let dq = supabase
              .from('restaurant_highlighted_dishes')
              .select('dish_name, mention_count, restaurant:restaurants(*)')
              .order('mention_count', { ascending: false })
              .limit(60)
            if (sanitized.trim()) {
              dq = dq.ilike('dish_name', `%${sanitized}%`)
            }
            const { data: dishRows, error: dishErr } = await dq
            if (!dishErr && dishRows) {
              const raw = (dishRows as unknown as Array<{
                dish_name: string
                mention_count: number | null
                restaurant: Restaurant | null
              }>)
                .filter(
                  (
                    d
                  ): d is {
                    dish_name: string
                    mention_count: number | null
                    restaurant: Restaurant
                  } => !!d.restaurant
                )
                .map((d) => ({
                  dish_name: d.dish_name,
                  mention_count: d.mention_count ?? 0,
                  tier: null,
                  isTopDish: false,
                  restaurant: d.restaurant,
                }))
              dishResults = collapse(raw).slice(0, 12)
            }
          }
        }
        if (cancelled) return
        setDishes(dishResults)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timer = setTimeout(performSearch, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, filters, sort, supabase])

  return {
    restaurants,
    dishes,
    neighborhoods,
    loading,
    total: restaurants.length + dishes.length,
  }
}
