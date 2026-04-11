import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    if (platform && platform !== 'tiktok' && platform !== 'instagram') {
      return NextResponse.json(
        { error: 'Parameter "platform" must be "tiktok" or "instagram"' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('restaurant_videos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('like_count', 500)
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

    return NextResponse.json(videos)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
