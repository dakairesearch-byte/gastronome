import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/auth/admin'
import {
  buildProfileUrl,
  buildReelEmbedUrl,
  buildReelUrl,
  extractReelShortcode,
  normalizeHandle,
} from '@/lib/instagram'

// Admin-only: accepts an Instagram handle + optional list of reel URLs
// and upserts them onto the restaurant. Gated on the ADMIN_USER_IDS
// env allowlist (see src/lib/auth/admin.ts). Returns 404 — not 403 — to
// avoid leaking the route's existence to non-admins.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const supabase = await createServerSupabaseClient()

    const admin = await requireAdminUser(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawHandle = typeof body.handle === 'string' ? body.handle : null
    const rawReelUrls = Array.isArray(body.reelUrls) ? body.reelUrls : []

    // Upper-bound the per-request payload. 50 reels is comfortably above
    // what a human curator would paste in one go; it just stops someone
    // from using this route as an unbounded insert pipe.
    const MAX_REELS_PER_REQUEST = 50
    if (rawReelUrls.length > MAX_REELS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many reel URLs (max ${MAX_REELS_PER_REQUEST})` },
        { status: 400 }
      )
    }

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
        console.error('admin/instagram handle update failed:', updateError)
        return NextResponse.json(
          { error: 'Failed to update handle' },
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
        console.error('admin/instagram reel upsert failed:', upsertError)
        return NextResponse.json(
          { error: 'Failed to upsert reels' },
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
