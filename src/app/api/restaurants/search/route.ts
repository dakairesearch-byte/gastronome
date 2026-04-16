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

    // Run name-match and cuisine-match as separate queries so PostgREST
    // operator strings never see raw user input.
    const pattern = `%${q}%`
    const [nameRes, cuisineRes] = await Promise.all([
      (() => {
        let q1 = supabase.from('restaurants').select('*').ilike('name', pattern).limit(25)
        if (city) q1 = q1.ilike('city', `%${city}%`)
        return q1
      })(),
      (() => {
        let q2 = supabase.from('restaurants').select('*').ilike('cuisine', pattern).limit(25)
        if (city) q2 = q2.ilike('city', `%${city}%`)
        return q2
      })(),
    ])

    if (nameRes.error || cuisineRes.error) {
      console.error('restaurants/search db error:', nameRes.error ?? cuisineRes.error)
      return NextResponse.json(
        { error: 'Database search failed' },
        { status: 500 }
      )
    }

    // De-dupe by id, name matches first.
    const localMap = new Map<string, Restaurant>()
    for (const row of (nameRes.data ?? []) as Restaurant[]) localMap.set(row.id, row)
    for (const row of (cuisineRes.data ?? []) as Restaurant[]) {
      if (!localMap.has(row.id)) localMap.set(row.id, row)
    }
    const localResults = Array.from(localMap.values())

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
        local: localResults,
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
