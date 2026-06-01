import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { searchPlaces } from '@/lib/google/places'
import type { Restaurant } from '@/types/database'

/**
 * Restaurant search.
 *
 * Two layers of defense:
 * 1. The local DB query uses two separate `.ilike()` calls instead of
 *    string-concatenating user input into a `.or()` filter. PostgREST
 *    treats `.or()` as a filter DSL, so anything put inside it must be
 *    trusted — the previous regex-strip sanitization was not enough.
 *    Parameter-bound `.ilike(col, pattern)` escapes the % and `,` that
 *    PostgREST treats as control characters.
 * 2. The Google Places call is billed per request, so it only runs for
 *    authenticated users. Unauthenticated callers still get the free
 *    local results.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const rawQ = searchParams.get('q')
    const rawCity = searchParams.get('city')

    if (!rawQ || rawQ.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    // Cap to keep pathological input from being echoed downstream.
    const q = rawQ.trim().slice(0, 120)
    const city = rawCity?.trim().slice(0, 80) || null

    const supabase = await createServerSupabaseClient()

    // Run every sub-query with parameter-bound `.ilike()` so PostgREST
    // operator strings never see raw user input. The `%` and `,` chars
    // are escaped by the binding, not concatenated into a `.or()` DSL.
    const pattern = `%${q}%`
    const cityPattern = city ? `%${city}%` : null

    const [nameRes, cuisineRes, neighborhoodRes, dishRes] = await Promise.all([
      // 1. Restaurants by name.
      (() => {
        let q1 = supabase.from('restaurants').select('*').ilike('name', pattern).limit(25)
        if (cityPattern) q1 = q1.ilike('city', cityPattern)
        return q1
      })(),
      // 2. Restaurants by cuisine.
      (() => {
        let q2 = supabase.from('restaurants').select('*').ilike('cuisine', pattern).limit(25)
        if (cityPattern) q2 = q2.ilike('city', cityPattern)
        return q2
      })(),
      // 3. Neighborhoods (D4) — distinct neighborhood + city, deduped in JS.
      (() => {
        let q3 = supabase
          .from('restaurants')
          .select('neighborhood, city')
          .ilike('neighborhood', pattern)
          .not('neighborhood', 'is', null)
          .limit(200)
        if (cityPattern) q3 = q3.ilike('city', cityPattern)
        return q3
      })(),
      // 4. Dishes (D5) — ranked top dishes by dish_name.
      supabase
        .from('restaurant_top_dishes')
        .select('dish_name, restaurant_id, score')
        .ilike('dish_name', pattern)
        .order('score', { ascending: false, nullsFirst: false })
        .limit(6),
    ])

    // Per-query error guards: log and treat a failed sub-query as empty
    // rather than 500-ing the whole route.
    if (nameRes.error) console.error('search: name query error:', nameRes.error)
    if (cuisineRes.error) console.error('search: cuisine query error:', cuisineRes.error)
    if (neighborhoodRes.error) console.error('search: neighborhood query error:', neighborhoodRes.error)
    if (dishRes.error) console.error('search: dish query error:', dishRes.error)

    // De-dupe restaurants by id, name matches first.
    const localMap = new Map<string, Restaurant>()
    for (const row of (nameRes.data ?? []) as Restaurant[]) localMap.set(row.id, row)
    for (const row of (cuisineRes.data ?? []) as Restaurant[]) {
      if (!localMap.has(row.id)) localMap.set(row.id, row)
    }
    const localResults = Array.from(localMap.values())

    // Collapse neighborhood rows to distinct neighborhood (+city) with a count.
    const neighborhoodMap = new Map<
      string,
      { neighborhood: string; city: string; count: number }
    >()
    for (const row of (neighborhoodRes.data ?? []) as Array<{
      neighborhood: string | null
      city: string | null
    }>) {
      if (!row.neighborhood) continue
      const cityVal = row.city ?? ''
      const key = `${row.neighborhood.toLowerCase()}|${cityVal.toLowerCase()}`
      const existing = neighborhoodMap.get(key)
      if (existing) existing.count += 1
      else neighborhoodMap.set(key, { neighborhood: row.neighborhood, city: cityVal, count: 1 })
    }
    const neighborhoods = Array.from(neighborhoodMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Resolve restaurant names for the dish hits (top_dishes has no FK
    // embed relationship in the generated types, so look names up by id).
    const dishRows = (dishRes.data ?? []) as Array<{
      dish_name: string
      restaurant_id: string
    }>
    let dishes: { dish_name: string; restaurant_id: string; restaurant_name: string }[] = []
    if (dishRows.length > 0) {
      const dishRestaurantIds = Array.from(new Set(dishRows.map((d) => d.restaurant_id)))
      const nameLookupRes = await supabase
        .from('restaurants')
        .select('id, name')
        .in('id', dishRestaurantIds)
      if (nameLookupRes.error) {
        console.error('search: dish restaurant-name lookup error:', nameLookupRes.error)
      }
      const idToName = new Map<string, string>()
      for (const r of (nameLookupRes.data ?? []) as Array<{ id: string; name: string }>) {
        idToName.set(r.id, r.name)
      }
      dishes = dishRows.map((d) => ({
        dish_name: d.dish_name,
        restaurant_id: d.restaurant_id,
        restaurant_name: idToName.get(d.restaurant_id) ?? '',
      }))
    }

    // Google Places is billed per call, so only authenticated users get
    // the external search. Everyone else sees the local catalog.
    let googleResults: unknown[] = []
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      try {
        const searchQuery = city ? `${q} restaurants in ${city}` : `${q} restaurant`
        googleResults = await searchPlaces(searchQuery, 10)
      } catch (e) {
        console.error('Google Places search failed:', e)
      }
    }

    return NextResponse.json(
      {
        // `restaurants` is the canonical key; `local` kept as an alias for
        // back-compat with the current client.
        restaurants: localResults,
        local: localResults,
        neighborhoods,
        dishes,
        google: googleResults,
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      }
    )
  } catch (error) {
    console.error('search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
