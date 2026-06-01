import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// restaurant_id is a UUID column. Validate the shape up front so malformed
// input returns a 400 instead of a Postgres "invalid input syntax for type
// uuid" error surfacing as a 500.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const restaurantId = searchParams.get('restaurantId')
    const platform = searchParams.get('platform')

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Query parameter "restaurantId" is required' },
        { status: 400 }
      )
    }

    if (!UUID_RE.test(restaurantId)) {
      return NextResponse.json(
        { error: 'Query parameter "restaurantId" must be a valid UUID' },
        { status: 400 }
      )
    }

    if (platform && platform !== 'tiktok' && platform !== 'instagram') {
      return NextResponse.json(
        { error: 'Parameter "platform" must be "tiktok" or "instagram"' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // IG rows are manually curated via the admin UI, so they don't need to
    // clear the 100-likes popularity threshold that TikTok rows do.
    let query = supabase
      .from('restaurant_videos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or('like_count.gte.100,platform.eq.instagram')
      .order('like_count', { ascending: false })
      .limit(20)

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data: videos, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      )
    }

    return NextResponse.json(videos, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('videos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
