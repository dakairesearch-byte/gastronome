/**
 * POST /api/impressions — analytics firehose for feed impression events.
 *
 * Accepts a JSON array of up to 50 impression events (the batch flushed by
 * src/lib/impressions.ts). Validates shape hard, silently drops invalid rows,
 * and inserts valid ones via the anon server client (which the INSERT-only RLS
 * policy allows). Returns 200 regardless of how many rows were accepted so
 * that client retry logic (sendBeacon has no retry) never spams the endpoint.
 *
 * Validation rules (per spec):
 *   - batch: array, length 1–50
 *   - event: must be one of the four enum values
 *   - restaurant_id / session_id: must match UUID v4 regex
 *   - surface: string, max 64 chars
 *   - position: integer 0–9999
 *
 * Security / spam tradeoff (documented in migration + CLAUDE.md):
 *   The table has INSERT-only RLS with check=true — any caller can append rows.
 *   This route is the only enforcement layer. A determined attacker can still
 *   flood it; the shape+batch caps limit per-request damage. Position logging
 *   and session ids are not PII-adjacent. Service-role reads are the only
 *   downstream read path (no anon SELECT policy exists).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ---------- validation constants ----------

const VALID_EVENTS = new Set(['impression', 'click', 'save', 'vote'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_SURFACE_LEN = 64
const MAX_BATCH = 50

// ---------- shape types ----------

interface RawRow {
  session_id?: unknown
  surface?: unknown
  position?: unknown
  restaurant_id?: unknown
  event?: unknown
}

interface ValidRow {
  session_id: string
  surface: string
  position: number
  restaurant_id: string
  event: string
  // user_id is NOT accepted from the client — it is resolved server-side via
  // the auth session to prevent spoofing.
  user_id: string | null
}

// ---------- handler ----------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse body — any parse failure is a silent 200 (sendBeacon callers can't
  // react to errors anyway; we never want the client to retry on bad data).
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ accepted: 0 }, { status: 200 })
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ accepted: 0 }, { status: 200 })
  }

  // Truncate oversized batches rather than reject — partial data is better
  // than no data, and this handles edge cases in the client flush logic.
  const raw = body.slice(0, MAX_BATCH) as RawRow[]

  // Resolve the authenticated user once for the whole batch.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // Validate each row; silently drop invalid ones.
  const valid: ValidRow[] = []

  for (const row of raw) {
    if (!row || typeof row !== 'object') continue

    const sessionId = typeof row.session_id === 'string' ? row.session_id.trim() : ''
    const surface = typeof row.surface === 'string' ? row.surface.trim() : ''
    const position = typeof row.position === 'number' ? row.position : NaN
    const restaurantId = typeof row.restaurant_id === 'string' ? row.restaurant_id.trim() : ''
    const event = typeof row.event === 'string' ? row.event.trim() : ''

    // Hard validation — drop the row silently on any failure.
    if (!UUID_RE.test(sessionId)) continue
    if (!UUID_RE.test(restaurantId)) continue
    if (!VALID_EVENTS.has(event)) continue
    if (!surface || surface.length > MAX_SURFACE_LEN) continue
    if (!Number.isInteger(position) || position < 0 || position > 9999) continue

    valid.push({
      session_id: sessionId,
      surface,
      position,
      restaurant_id: restaurantId,
      event,
      user_id: userId,
    })
  }

  if (valid.length === 0) {
    return NextResponse.json({ accepted: 0 }, { status: 200 })
  }

  // Insert via anon server client — the INSERT-only RLS policy permits this.
  // feed_impressions is in the generated Database types (regenerated after
  // migration 20260610000002), so this is a fully typed insert.
  const { error } = await supabase.from('feed_impressions').insert(valid)

  if (error) {
    // Log server-side for observability but return 200 to the client — the
    // caller (sendBeacon) cannot act on a non-200 and must not retry.
    console.error('[impressions] insert error:', error.message)
  }

  return NextResponse.json({ accepted: valid.length }, { status: 200 })
}
