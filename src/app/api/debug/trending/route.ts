import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/auth/admin'
import { debugTrending } from '@/lib/ranking/trending'
import { WEIGHTS, DEFAULT_WINDOW, type Window } from '@/lib/ranking/weights'

// Admin-only: returns the raw event counts feeding a restaurant's trending
// score so we can answer "why is X trending" with real numbers rather than
// a black-box rank. Gated via the ADMIN_USER_IDS allowlist; returns 404
// to non-admins so the route's existence isn't a signal to probe further.

function isWindow(value: string | null): value is Window {
  return value === '24h' || value === '7d' || value === '30d'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const admin = await requireAdminUser(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Query parameter "id" is required' },
        { status: 400 }
      )
    }

    const rawWindow = searchParams.get('window')
    const window: Window = isWindow(rawWindow) ? rawWindow : DEFAULT_WINDOW

    const score = await debugTrending(supabase, id, { window })
    if (!score) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      restaurant_id: score.restaurant_id,
      window,
      city: score.city,
      cuisine: score.cuisine,
      counts: score.counts,
      weights: WEIGHTS,
      raw_score: score.raw_score,
      normalized_score: score.normalized_score,
      explanation: {
        raw_formula: `${score.counts.videos} videos * ${WEIGHTS.video} + ${score.counts.reviews} reviews * ${WEIGHTS.review} + ${score.counts.photos} photos * ${WEIGHTS.photo} = ${score.raw_score}`,
        normalization:
          'normalized_score = raw_score / median(raw_score across restaurants in same city), falling back to global median when the city is too sparse.',
      },
    })
  } catch (error) {
    console.error('debug/trending error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
