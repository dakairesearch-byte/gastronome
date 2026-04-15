import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  buildProfileUrl,
  buildReelEmbedUrl,
  buildReelUrl,
  extractReelShortcode,
  normalizeHandle,
} from '@/lib/instagram'

// TODO: gate behind a proper is_admin role once that column exists.
// Today this only checks authentication — any signed-in user can edit.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawHandle = typeof body.handle === 'string' ? body.handle : null
    const rawReelUrls = Array.isArray(body.reelUrls) ? body.reelUrls : []

    if (!rawHandle && rawReelUrls.length === 0) {
      return NextResponse.json(
        { error: 'Provide at least a handle or one reel URL' },
        { status: 400 }
      )
    }

    // Verify the restaurant exists before we touch anything
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    let handleUpdated = false
    if (rawHandle !== null) {
      const normalized = normalizeHandle(rawHandle)
      if (rawHandle.trim() !== '' && !normalized) {
        return NextResponse.json(
          { error: `Invalid Instagram handle: "${rawHandle}"` },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          instagram_handle: normalized,
          instagram_url: normalized ? buildProfileUrl(normalized) : null,
          instagram_last_fetched_at: new Date().toISOString(),
        })
        .eq('id', restaurantId)

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update handle: ${updateError.message}` },
          { status: 500 }
        )
      }
      handleUpdated = true
    }

    const invalidUrls: string[] = []
    const rows: Array<{
      restaurant_id: string
      platform: 'instagram'
      video_id: string
      video_url: string
      embed_url: string
      fetched_at: string
    }> = []

    for (const entry of rawReelUrls) {
      if (typeof entry !== 'string') continue
      const shortcode = extractReelShortcode(entry)
      if (!shortcode) {
        invalidUrls.push(entry)
        continue
      }
      rows.push({
        restaurant_id: restaurantId,
        platform: 'instagram',
        video_id: shortcode,
        video_url: buildReelUrl(shortcode),
        embed_url: buildReelEmbedUrl(shortcode),
        fetched_at: new Date().toISOString(),
      })
    }

    let inserted = 0
    if (rows.length > 0) {
      const { error: upsertError, count } = await supabase
        .from('restaurant_videos')
        .upsert(rows, {
          onConflict: 'restaurant_id,platform,video_id',
          ignoreDuplicates: false,
          count: 'exact',
        })

      if (upsertError) {
        return NextResponse.json(
          { error: `Failed to upsert reels: ${upsertError.message}` },
          { status: 500 }
        )
      }
      inserted = count ?? rows.length
    }

    return NextResponse.json({
      success: true,
      handleUpdated,
      inserted,
      invalid: invalidUrls,
    })
  } catch (error) {
    console.error('admin/instagram error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
