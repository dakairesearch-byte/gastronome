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
} from 'lucide-react'
import { Restaurant } from '@/types/database'
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
    const str = next.toString()
    const target = str ? `${pathname}?${str}` : pathname
    if (target !== `${pathname}${window.location.search}`) {
      router.replace(target, { scroll: false })
    }
    writeStoredFilters(filters)
  }, [filters, searchQuery, pathname, router])

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
        const results = await Promise.all(
          predictions
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
            .map(
              (prediction) =>
                new Promise<GooglePlaceResult | null>((resolve) => {
                  const map = document.createElement('div')
                  const placesService = new window.google!.maps!.places!.PlacesService(map)
                  placesService.getDetails(
                    {
                      placeId: prediction.place_id,
                      fields: ['name', 'formatted_address', 'geometry', 'rating', 'place_id'],
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (place: any, status: string) => {
                      if (status === 'OK' && place) {
                        const address = place.formatted_address || ''
                        const parts = address.split(',')
                        const city =
                          parts.length > 1 ? parts[parts.length - 2].trim() : ''
                        resolve({
                          placeId: prediction.place_id,
                          name: place.name,
                          address,
                          city,
                          rating: place.rating,
                        })
                      } else {
                        resolve(null)
                      }
                    }
                  )
                })
            )
        )
        return results.filter((r): r is GooglePlaceResult => r !== null)
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
        supabase.from('restaurants').select('cuisine'),
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
              `name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%,city.ilike.%${sanitized}%`
            )
          }
          if (filters.cities.length) {
            // Build an `.in()` on city — match values are exact (case-insensitive
            // handled by Supabase? not always). Use a case-insensitive OR list
            // so 'New York' and 'new york' both match.
            rq = rq.in('city', filters.cities)
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
            rq = rq.eq('james_beard_winner', true)
          } else if (filters.jamesBeard === 'nominee') {
            // "Nominee" is inclusive of winner — a winner was nominated.
            rq = rq.or('james_beard_winner.eq.true,james_beard_nominated.eq.true')
          }
          if (filters.eater38) {
            rq = rq.eq('eater_38', true)
          }

          const { data } = await rq.order('name', { ascending: true }).limit(40)
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
            if (filters.cities.length) bq = bq.in('city', filters.cities)
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
            else if (filters.jamesBeard === 'nominee')
              bq = bq.or('james_beard_winner.eq.true,james_beard_nominated.eq.true')
            if (filters.eater38) bq = bq.eq('eater_38', true)
            const { data: bibRows } = await bq
              .order('name', { ascending: true })
              .limit(40)
            const seen = new Set(restaurantData.map((r) => r.id))
            for (const row of (bibRows ?? []) as Restaurant[]) {
              if (!seen.has(row.id)) {
                restaurantData.push(row)
                seen.add(row.id)
              }
            }
          }
        }

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
  }, [searchQuery, filters, supabase, googleApiReady, searchGooglePlaces])

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                           */
  /* ------------------------------------------------------------------ */

  const handleResetAll = () => {
    setFilters(DEFAULT_FILTERS)
    setSearchQuery('')
    writeStoredFilters(DEFAULT_FILTERS)
    router.replace(pathname, { scroll: false })
  }

  const totalRestaurants = restaurants.length + googlePlaces.length
  const hasAnyResults = totalRestaurants > 0 || dishes.length > 0
  const activeFilterCount = useMemo(() => countActive(filters), [filters])

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

            {/* Loading */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <RestaurantCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* No Results */}
            {!loading && !hasAnyResults && (
              <EmptyState
                icon={Search}
                title={
                  searchQuery || activeFilterCount > 0
                    ? 'No results found'
                    : filters.mode === 'dishes'
                    ? 'Search for a dish'
                    : 'Start searching'
                }
                description={
                  searchQuery || activeFilterCount > 0
                    ? 'Try relaxing a filter or adjusting your search terms.'
                    : filters.mode === 'dishes'
                    ? 'Try "ramen", "pizza", or "cacio e pepe" to find which spots do it best.'
                    : 'Enter a restaurant, cuisine, city, or dish to get started.'
                }
                ctaText={activeFilterCount > 0 ? 'Reset filters' : 'Discover'}
                ctaHref={activeFilterCount > 0 ? undefined : '/explore'}
                onCtaClick={
                  activeFilterCount > 0 ? handleResetAll : undefined
                }
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

                {restaurants.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}

                {googlePlaces.length > 0 && (
                  <>
                    {restaurants.length > 0 && (
                      <div className="flex items-center gap-2 pt-2">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <MapPin size={12} /> From Google
                        </span>
                        <div className="h-px bg-gray-200 flex-1" />
                      </div>
                    )}
                    {googlePlaces.map((place) => (
                      <Link
                        key={place.placeId}
                        href={`/review/new?name=${encodeURIComponent(place.name)}&city=${encodeURIComponent(place.city)}&address=${encodeURIComponent(place.address)}`}
                        className="block bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-shadow"
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
                      </Link>
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
                Apply filters
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
  if (f.jamesBeard === 'winner' && !r.james_beard_winner) return false
  if (
    f.jamesBeard === 'nominee' &&
    !r.james_beard_winner &&
    !r.james_beard_nominated
  )
    return false
  if (f.eater38 && !r.eater_38) return false
  return true
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SearchContent />
    </Suspense>
  )
}
