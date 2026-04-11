import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchAllSourcesForRestaurant } from '@/lib/apify/fetchAll'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { restaurantId } = body

    if (!restaurantId || typeof restaurantId !== 'string') {
      return NextResponse.json(
        { error: 'restaurantId is required and must be a string' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Fetch the restaurant from DB
    const { data: restaurant, error: fetchError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single()

    if (fetchError || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Create a fetch_log entry with status='running'
    const { data: fetchLog, error: logInsertError } = await supabase
      .from('fetch_logs')
      .insert({
        restaurant_id: restaurantId,
        source: 'all',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (logInsertError) {
      return NextResponse.json(
        { error: 'Failed to create fetch log' },
        { status: 500 }
      )
    }

    try {
      // Fetch ratings from all sources
      const results = await fetchAllSourcesForRestaurant(
        restaurant.id,
        restaurant.name,
        restaurant.city ?? ''
      )

      // Update the fetch log to success
      await supabase
        .from('fetch_logs')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          metadata: results as unknown as Record<string, unknown> as any,
        })
        .eq('id', fetchLog.id)

      return NextResponse.json({ success: true, results })
    } catch (fetchAllError) {
      // Update the fetch log to error
      const errorMessage =
        fetchAllError instanceof Error
          ? fetchAllError.message
          : 'Unknown error during fetch'

      await supabase
        .from('fetch_logs')
        .update({
          status: 'error',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', fetchLog.id)

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
