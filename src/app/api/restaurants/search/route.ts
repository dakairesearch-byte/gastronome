 import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { runActor, getDatasetItems } from '@/lib/apify/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')
    const city = searchParams.get('city')

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Sanitize query to prevent PostgREST filter injection
    const sanitized = q.replace(/[,.()"\\]/g, '')

    // Search local DB with ilike on name and cuisine
    let query = supabase
      .from('restaurants')
      .select('*')
      .or(`name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%`)

    if (city) {
      query = query.ilike('city', `%${city}%`)
    }

    const { data: localResults, error: dbError } = await query

    if (dbError) {
      return NextResponse.json(
        { error: 'Database search failed' },
        { status: 500 }
      )
    }

    // Search Google Places via Apify
    let googleResults: unknown[] = []
    try {
      const searchQuery = city ? `${q} restaurants in ${city}` : `${q} restaurant`

      const run = await runActor('compass/crawler-google-places', {
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: 10,
        language: 'en',
        maxReviews: 0,
      })

      const items = await getDatasetItems(run.defaultDatasetId)
      googleResults = items ?? []
    } catch {
      // If Google search fails, still return local results
      console.error('Google Places search via Apify failed')
    }

    return NextResponse.json({
      local: localResults ?? [],
      google: googleResults,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import apifyClient from '@/lib/apify/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')
    const city = searchParams.get('city')

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Sanitize query to prevent PostgREST filter injection
    const sanitized = q.replace(/[,.()"\\]/g, '')

    // Search local DB with ilike on name and cuisine
    let query = supabase
      .from('restaurants')
      .select('*')
      .or(`name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%`)

    if (city) {
      query = query.ilike('city', `%${city}%`)
    }

    const { data: localResults, error: dbError } = await query

    if (dbError) {
      return NextResponse.json(
        { error: 'Database search failed' },
        { status: 500 }
      )
    }

    // Search Google Places via Apify
    let googleResults: unknown[] = []
    try {
      const searchQuery = city ? `${q} restaurants in ${city}` : `${q} restaurant`

      const run = await apifyClient.actor('compass/crawler-google-places').call({
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: 10,
        language: 'en',
        maxReviews: 0,
      })

      const { items } = await apifyClient
        .dataset(run.defaultDatasetId)
        .listItems()

      googleResults = items ?? []
    } catch {
      // If Google search fails, still return local results
      console.error('Google Places search via Apify failed')
    }

    return NextResponse.json({
      local: localResults ?? [],
      google: googleResults,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
