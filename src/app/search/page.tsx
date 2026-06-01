'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/SearchBar'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import {
  Search,
  MapPin,
  Utensils,
  Sliders,
  X,
  ChevronDown,
} from 'lucide-react'
import { Restaurant } from '@/types/database'
import { gastronomeScore } from '@/lib/score'
import Link from 'next/link'
import SearchFiltersSidebar, {
  DEFAULT_FILTERS,
  countActive,
  type SearchFilters,
} from '@/components/search/SearchFiltersSidebar'
import {
  filtersFromURL,
  filtersToURL,
  isDefaultFilters,
  readStoredFilters,
  writeStoredFilters,
} from '@/components/search/filterState'

interface GooglePlaceResult {
  placeId: string
  name: string
  address: string
  city: string
  rating?: number
}

interface DishHit {
  dish_name: string
  mention_count: number
  restaurant: Restaurant
}

/* ------------------------------------------------------------------ */
/*  Sort + result-cap config                                            */
/* ------------------------------------------------------------------ */

type SortKey = 'gastronome' | 'google' | 'count' | 'name'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'gastronome', label: 'Gastronome Score' },
  { key: 'google', label: 'Google rating' },
  { key: 'count', label: 'Review count' },
  { key: 'name', label: 'Name (A–Z)' },
]

function parseSortKey(v: string | null | undefined): SortKey {
  return v === 'google' || v === 'count' || v === 'name' ? v : 'gastronome'
}

// Hard server-side cap on restaurant rows per query. Results beyond this are
// not fetched; the UI says so plainly instead of faking "M+" / infinite
// scroll. Raising this is a query-cost decision, not a UI tweak.
const RESULT_CAP = 40

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

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  const urlQuery = searchParams.get('q') || ''
  const [searchQuery, setSearchQuery] = useState(urlQuery)

  // Sort is URL-driven (shareable) and independent of the filter object so
  // it doesn't pollute filterState's serialization. Default is the
  // Gastronome Score — the product's headline ranking — applied client-side
  // via lib/score.ts since the score isn't a stored column we can .order()
  // on. The other three keys map to real DB columns and are pushed to the
  // server query for correct ordering across the full result set.
  const [sort, setSort] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')))

  // Filters: read URL → fall back to localStorage → fall back to defaults.
  // Storing the initial resolution in a ref lets the URL-restore effect
  // below rewrite the URL without us losing the intent on the first render.
  const didHydrate = useRef(false)
  const [filters, setFilters] = useState<SearchFilters>(() =>
    // Build a real URLSearchParams so filtersFromURL can reuse it safely.
    // On the server, searchParams.toString() returns '' and we fall through
    // to defaults; localStorage is read in the hydration effect below.
    filtersFromURL(new URLSearchParams(searchParams.toString()))
  )

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [googlePlaces, setGooglePlaces] = useState<GooglePlaceResult[]>([])
  const [dishes, setDishes] = useState<DishHit[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  /* ------------------------------------------------------------------ */
  /*  One-time hydration: restore from localStorage when URL is bare      */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    const fromUrl = filtersFromURL(new URLSearchParams(window.location.search))
    const urlHasFilters = !isDefaultFilters(fromUrl)
    if (urlHasFilters) {
      setFilters(fromUrl)
      return
    }
    const stored = readStoredFilters()
    if (stored && !isDefaultFilters(stored)) {
      setFilters(stored)
      // Push stored filters into URL so the back/forward buttons stay honest.
      const next = filtersToURL(stored, new URLSearchParams(window.location.search))
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }
  }, [pathname, router])

  /* ------------------------------------------------------------------ */
  /*  URL + localStorage sync on every filter change                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!didHydrate.current) return
    const current = new URLSearchParams(window.location.search)
    const next = filtersToURL(filters, current)
    // Preserve q= separately so filter tweaks don't clobber the query.
    if (searchQuery.trim()) next.set('q', searchQuery.trim())
    else next.delete('q')
    // Sort lives outside the filter object; default ('gastronome') stays
    // out of the URL to keep it clean.
    if (sort !== 'gastronome') next.set('sort', sort)
    else next.delete('sort')
    const str = next.toString()
    const target = str ? `${pathname}?${str}` : pathname
    if (target !== `${pathname}${window.location.search}`) {
      router.replace(target, { scroll: false })
    }
    writeStoredFilters(filters)
  }, [filters, searchQuery, sort, pathname, router])

  /* ------------------------------------------------------------------ */
  /*  Google Places autocomplete                                         */
  /* ------------------------------------------------------------------ */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteServiceRef = useRef<any>(null)
  const [googleApiReady, setGoogleApiReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

  useEffect(() => {
    if (!apiKey) return
    if (window.google?.maps?.places) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      setGoogleApiReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps?.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
        setGoogleApiReady(true)
      }
    }
    document.head.appendChild(script)
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [apiKey])

  const searchGooglePlaces = useCallback(
    async (q: string): Promise<GooglePlaceResult[]> => {
      if (!q.trim() || !autocompleteServiceRef.current) return []
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const predictions = await new Promise<any[]>((resolve) => {
          autocompleteServiceRef.current.getPlacePredictions(
            { input: q, types: ['establishment'] },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (predictions: any[], status: string) => {
              if (status === 'OK' && predictions) resolve(predictions)
              else resolve([])
            }
          )
        })
        // Build the typeahead straight from the (cheap) Autocomplete
        // predictions. Calling Place Details (getDetails) per prediction on
        // every keystroke fired up to 8 billed requests per character — orders
        // of magnitude more expensive. Details (geometry/rating) can be fetched
        // lazily on selection if a consumer ever needs them.
        const results: GooglePlaceResult[] = predictions
          .filter((p) => {
            const types = p.types || []
            return (
              types.includes('restaurant') ||
              types.includes('food') ||
              types.includes('cafe') ||
              types.includes('bakery') ||
              types.includes('bar') ||
              types.includes('meal_delivery') ||
              types.includes('meal_takeaway')
            )
          })
          .slice(0, 8)
          .map((prediction) => {
            const main = prediction.structured_formatting?.main_text ?? prediction.description ?? ''
            const secondary = prediction.structured_formatting?.secondary_text ?? ''
            const parts = secondary.split(',')
            const city = parts.length > 1 ? parts[parts.length - 2].trim() : parts[0]?.trim() ?? ''
            return {
              placeId: prediction.place_id,
              name: main,
              address: secondary,
              city,
              rating: undefined,
            } as GooglePlaceResult
          })
        return results
      } catch {
        return []
      }
    },
    []
  )

  /* ------------------------------------------------------------------ */
  /*  Load filter options (covered cities + cuisine list)                */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false
    async function loadFacets() {
      const [citiesRes, cuisinesRes] = await Promise.all([
        // Cities we actually cover — from the `cities` table, not scattered
        // restaurant.city values which include typos and non-covered spots.
        supabase
          .from('cities')
          .select('name, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        // Distinct cuisines for the filter facet. Bound the scan and skip
        // nulls rather than pulling every restaurant row's cuisine.
        supabase
          .from('restaurants')
          .select('cuisine')
          .not('cuisine', 'is', null)
          .limit(1000),
      ])
      if (cancelled) return
      const cityNames = (citiesRes.data ?? [])
        .map((c) => c.name)
        .filter(Boolean)
      setAvailableCities(cityNames)
      const cuisines = [
        ...new Set((cuisinesRes.data ?? []).map((r) => r.cuisine).filter(Boolean)),
      ].sort() as string[]
      setAvailableCuisines(cuisines)
    }
    loadFacets()
    return () => {
      cancelled = true
    }
  }, [supabase])

  /* ------------------------------------------------------------------ */
  /*  Main search — applies query + every filter in `filters`             */
  /* ------------------------------------------------------------------ */

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

          if (searchQuery.trim()) {
            const sanitized = searchQuery.replace(/[%_\\]/g, '')
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
            if (searchQuery.trim()) {
              const sanitized = searchQuery.replace(/[%_\\]/g, '')
              bq = bq.or(
                `name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%,city.ilike.%${sanitized}%`
              )
            }
            if (filters.cities.length) bq = bq.or(cityIlikeClause(filters.cities))
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

        /* -------------------- Google Places -------------------- */
        let googleResults: GooglePlaceResult[] = []
        if (
          wantRestaurants &&
          searchQuery.trim() &&
          googleApiReady &&
          // Skip external API when facet filters are active — those results
          // can't satisfy rating/accolade constraints the user asked for.
          countActive(filters) === (filters.mode !== 'all' ? 1 : 0)
        ) {
          googleResults = await searchGooglePlaces(searchQuery)
          const localNames = new Set(
            restaurantData.map((r) => r.name.toLowerCase())
          )
          googleResults = googleResults.filter(
            (g) => !localNames.has(g.name.toLowerCase())
          )
        }
        if (cancelled) return
        setGooglePlaces(googleResults)

        /* -------------------- dish query -------------------- */
        let dishResults: DishHit[] = []
        if (wantDishes && (searchQuery.trim() || filters.mode === 'dishes')) {
          const sanitized = searchQuery.replace(/[%_\\]/g, '')
          let dq = supabase
            .from('restaurant_highlighted_dishes')
            .select('dish_name, mention_count, restaurant:restaurants(*)')
            .order('mention_count', { ascending: false })
            .limit(40)
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
                (d): d is {
                  dish_name: string
                  mention_count: number | null
                  restaurant: Restaurant
                } => !!d.restaurant
              )
              .map((d) => ({
                dish_name: d.dish_name,
                mention_count: d.mention_count ?? 0,
                restaurant: d.restaurant,
              }))

            // Post-filter dishes using the restaurant's accolades/ratings.
            dishResults = raw.filter((d) => matchesFilters(d.restaurant, filters))
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
  }, [searchQuery, filters, sort, supabase, googleApiReady, searchGooglePlaces])

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                           */
  /* ------------------------------------------------------------------ */

  // "Reset all" used to wipe both filters AND the search query, which
  // matched the button text "Reset all" too literally — users called it
  // "Clear filters" and were surprised when their query disappeared too.
  // Now it only clears filters and leaves the query alone. Sweep v2
  // filtering QW: "Reset all also wipes the search query — should only
  // clear filters."
  const handleResetAll = () => {
    setFilters(DEFAULT_FILTERS)
    writeStoredFilters(DEFAULT_FILTERS)
    // Preserve `q` in the URL when present so the search query stays.
    const next = searchQuery.trim()
      ? `${pathname}?q=${encodeURIComponent(searchQuery)}`
      : pathname
    router.replace(next, { scroll: false })
  }

  // Single canonical result total, used by both the header summary and the
  // mobile "Show N results" button so they can never disagree. Counts every
  // surfaced row consistently: covered restaurants + dishes + the
  // informational Google matches.
  const totalRestaurants = restaurants.length + googlePlaces.length
  const totalResults = totalRestaurants + dishes.length
  const hasAnyResults = totalResults > 0
  const activeFilterCount = useMemo(() => countActive(filters), [filters])

  // Identify the most restrictive active filter to name in the zero-
  // result empty state ("the Google ≥4.1 filter is the most
  // restrictive"). Heuristic: rating/review thresholds and single-
  // select accolades tend to cut hardest, so we surface those first.
  const mostRestrictiveFilterLabel = useMemo(() => {
    if (filters.googleMinReviews > 0) return `Google ≥${filters.googleMinReviews} reviews`
    if (filters.yelpMinReviews > 0) return `Yelp ≥${filters.yelpMinReviews} reviews`
    if (filters.googleMinRating > 0) return `Google ≥${filters.googleMinRating}★`
    if (filters.yelpMinRating > 0) return `Yelp ≥${filters.yelpMinRating}★`
    if (filters.michelinStars.length) return 'Michelin stars'
    if (filters.jamesBeard !== 'any') return 'James Beard'
    if (filters.eater38) return 'Eater 38'
    if (filters.bibGourmand) return 'Bib Gourmand'
    if (filters.cuisines.length) return `cuisine (${filters.cuisines[0]})`
    if (filters.cities.length) return `city (${filters.cities[0]})`
    return null
  }, [filters])

  // Results are server-capped at RESULT_CAP rows. We render the full
  // fetched set (no client pagination) and, when the cap is hit, tell the
  // user plainly that results are capped — rather than the old deceptive
  // "N of M+" with a fake infinite-scroll sentinel that never fetched
  // beyond the cap. Real .range() pagination isn't viable here because the
  // default 'gastronome' sort is computed client-side over the whole set
  // (and the bib-union follow-up query appends rows), so a per-page server
  // window can't be ordered correctly. If deeper results are needed later,
  // narrowing the query (city/cuisine/rating filters) is the intended path.
  const resultsCapped = restaurants.length >= RESULT_CAP

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-500 mt-1">
            Find restaurants by name, cuisine, or city — or search dishes directly.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Sidebar — desktop */}
          <div className="hidden lg:block">
            <SearchFiltersSidebar
              filters={filters}
              onChange={setFilters}
              onReset={handleResetAll}
              availableCities={availableCities}
              availableCuisines={availableCuisines}
            />
          </div>

          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Top bar: search + mobile filter trigger */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBar
                  placeholder={
                    filters.mode === 'dishes'
                      ? 'Search dishes — try "ramen" or "cacio e pepe"…'
                      : 'Search restaurants, cuisines, or cities…'
                  }
                  initialValue={searchQuery}
                  onSearch={setSearchQuery}
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden relative flex items-center gap-1.5 px-3 min-h-[44px] text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                <Sliders size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-emerald-500 text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active filter summary (also visible on desktop for quick reset) */}
            {activeFilterCount > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <span>
                  <span className="font-semibold text-gray-900">
                    {activeFilterCount}
                  </span>{' '}
                  {activeFilterCount === 1 ? 'filter' : 'filters'} active{' '}
                  <span className="text-gray-400">
                    · filters persist across visits until you reset
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Reset all
                </button>
              </div>
            )}

            {/* Sort control — URL-driven. Hidden when there are no
                restaurant rows to order (dishes have their own ordering). */}
            {!loading && restaurants.length > 0 && (
              <div className="flex items-center justify-end gap-2">
                <label
                  htmlFor="search-sort"
                  className="text-xs font-medium text-gray-500"
                >
                  Sort by
                </label>
                <div className="relative">
                  <select
                    id="search-sort"
                    value={sort}
                    onChange={(e) => setSort(parseSortKey(e.target.value))}
                    className="appearance-none text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 cursor-pointer hover:bg-gray-50 focus:outline-none focus:border-emerald-400"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <RestaurantCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* No Results — when filters are active, name the most
                restrictive one so the user knows what to loosen, and
                always offer a "Browse all" escape alongside "Reset
                filters" so the state is never a dead end. Sweep v2
                empty-states P1 + QW. */}
            {!loading && !hasAnyResults && (
              <EmptyState
                icon={Search}
                tone={searchQuery || activeFilterCount > 0 ? 'attention' : 'neutral'}
                title={
                  searchQuery || activeFilterCount > 0
                    ? 'No results found'
                    : filters.mode === 'dishes'
                    ? 'Search for a dish'
                    : 'Start searching'
                }
                description={
                  activeFilterCount > 0
                    ? `Nothing matches all ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}${mostRestrictiveFilterLabel ? ` — the ${mostRestrictiveFilterLabel} filter is the most restrictive.` : '.'} Try removing one.`
                    : searchQuery
                    ? `No matches for “${searchQuery}”. Check the spelling or try a broader term.`
                    : filters.mode === 'dishes'
                    ? 'Try "ramen", "pizza", or "cacio e pepe" to find which spots do it best.'
                    : 'Enter a restaurant, cuisine, city, or dish to get started.'
                }
                ctaText={activeFilterCount > 0 ? 'Reset filters' : 'Browse restaurants'}
                ctaHref={activeFilterCount > 0 ? undefined : '/explore'}
                onCtaClick={activeFilterCount > 0 ? handleResetAll : undefined}
                secondaryCtaText={activeFilterCount > 0 ? 'Browse all restaurants' : undefined}
                secondaryCtaHref={activeFilterCount > 0 ? '/explore' : undefined}
              />
            )}

            {/* Results */}
            {!loading && hasAnyResults && (
              <div className="space-y-3">
                {dishes.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px bg-gray-200 flex-1" />
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        <Utensils size={12} />
                        {searchQuery
                          ? <>Dishes matching &ldquo;{searchQuery}&rdquo;</>
                          : 'Top dishes'}
                      </span>
                      <div className="h-px bg-gray-200 flex-1" />
                    </div>
                    {dishes.map((d, i) => (
                      <Link
                        key={`${d.restaurant.id}-${d.dish_name}-${i}`}
                        href={`/restaurants/${d.restaurant.id}`}
                        className="block bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <Utensils size={18} className="text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {d.dish_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              at {d.restaurant.name}
                              {d.restaurant.city ? ` · ${d.restaurant.city}` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                            {d.mention_count}{' '}
                            {d.mention_count === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                      </Link>
                    ))}
                    {restaurants.length > 0 && (
                      <div className="flex items-center gap-2 pt-2">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-xs text-gray-400 font-medium">
                          Restaurants
                        </span>
                        <div className="h-px bg-gray-200 flex-1" />
                      </div>
                    )}
                  </>
                )}

                {restaurants.length > 0 && (
                  <p className="text-xs text-gray-500 pt-1">
                    Showing{' '}
                    <span className="font-semibold text-gray-700">
                      {restaurants.length}
                    </span>{' '}
                    {restaurants.length === 1 ? 'restaurant' : 'restaurants'}
                    {/* Honest cap notice — no fake "+" implying more are a
                        scroll away. Results are limited to RESULT_CAP. */}
                    {resultsCapped && (
                      <span className="text-gray-400">
                        {' '}· showing the top {RESULT_CAP} — narrow with
                        filters to see more
                      </span>
                    )}
                  </p>
                )}

                {restaurants.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}

                {googlePlaces.length > 0 && (
                  <>
                    {restaurants.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2">
                          <div className="h-px bg-gray-200 flex-1" />
                          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <MapPin size={12} aria-hidden="true" /> From Google
                          </span>
                          <div className="h-px bg-gray-200 flex-1" />
                        </div>
                        {/* Informational only. The "tap to add a review /
                            put it on the map" CTA was removed: user reviews
                            and user-created restaurants no longer exist, so
                            /review/new is dead. We still surface Google
                            matches so users know the place exists even though
                            it isn't covered yet — but the rows are no longer
                            interactive (no link target to send them to). */}
                        <p className="text-[11px] text-gray-400 text-center mt-1.5">
                          Not in Gastronome yet — not covered, shown for reference.
                        </p>
                      </div>
                    )}
                    {googlePlaces.map((place) => (
                      <div
                        key={place.placeId}
                        className="block bg-white rounded-lg border border-gray-100 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <MapPin size={18} className="text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {place.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {place.city}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {place.rating && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                {place.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between bg-white border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <SearchFiltersSidebar
                filters={filters}
                onChange={setFilters}
                onReset={handleResetAll}
                availableCities={availableCities}
                availableCuisines={availableCuisines}
              />
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {/* Show the live result count so users don't close the
                    sheet and discover zero results. Sweep v2 P1. */}
                {loading
                  ? 'Searching…'
                  : totalResults === 0
                    ? 'No matches — adjust filters'
                    : `Show ${totalResults} ${totalResults === 1 ? 'result' : 'results'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Check whether a restaurant passes the active filter set. Used for
 * post-filtering dish results (we can't push every predicate through the
 * joined select in a single query).
 */
function matchesFilters(r: Restaurant, f: SearchFilters): boolean {
  if (f.cities.length && !f.cities.some((c) => c.toLowerCase() === r.city?.toLowerCase()))
    return false
  if (f.cuisines.length && !f.cuisines.includes(r.cuisine)) return false
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

/**
 * Server shell rendered before SearchContent hydrates. The previous
 * Suspense fallback was a featureless blank div, so cold loads and
 * crawlers saw nothing — including no nav, no heading, no search bar
 * — until client JS hydrated. Sweep v2 loading-states Alarming.
 *
 * This shell renders the page heading and a static "search loading"
 * affordance so users on slow connections (and SEO crawlers) get a
 * real first paint.
 */
function SearchShell() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <h1
          className="text-3xl mb-2"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            color: 'var(--color-text)',
          }}
        >
          Search
        </h1>
        <p
          className="text-sm mb-6"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Find restaurants by name, cuisine, or city — or search dishes directly.
        </p>
        <div className="animate-shimmer h-12 rounded-xl max-w-2xl" />
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchShell />}>
      <SearchContent />
    </Suspense>
  )
}
