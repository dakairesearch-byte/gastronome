/**
 * Feed event aggregation for the /recent page.
 *
 * Derives a timeline of "things that happened to the data" from the
 * existing tables (no new events table). Video events are grouped per
 * (restaurant, day) so we render "5 new TikToks for Lucali" instead of
 * five individual rows.
 *
 * Everything is read-only. Adding a new event kind = add a new branch to
 * `fetchRecentEvents` + a new case in the UI's event renderer.
 *
 * TODO: "Editorial list inclusion" events (Eater/James Beard/Michelin)
 * can't be surfaced today because the flags on `restaurants` have no
 * per-inclusion timestamp. Add those when the schema grows a
 * `list_inclusions` table with a `created_at`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Supabase = SupabaseClient<Database>

export type EventKind = 'restaurant_added' | 'videos_added' | 'review_added' | 'photos_added'

export interface FeedEvent {
  id: string
  kind: EventKind
  timestamp: string // ISO
  restaurant_id: string
  restaurant_name: string
  restaurant_city: string | null
  count?: number // for grouped events (e.g. 5 new TikToks)
  platform?: 'tiktok' | 'instagram'
}

const DEFAULT_LOOKBACK_DAYS = 30
const MAX_PER_KIND = 200

function isoDay(date: Date): string {
  // YYYY-MM-DD bucket for per-day grouping. Uses UTC to match DB timestamps.
  return date.toISOString().slice(0, 10)
}

/**
 * Fetch up to ~30 days of event activity across every event source.
 * Returns a flat, already-merged-and-sorted list with the newest events
 * first.
 */
export async function fetchRecentEvents(
  supabase: Supabase,
  options: { lookbackDays?: number } = {}
): Promise<FeedEvent[]> {
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS
  const cutoff = new Date(
    Date.now() - lookbackDays * 24 * 3600 * 1000
  ).toISOString()

  // Fetch in parallel. We intentionally don't filter on city — /recent is
  // global by design.
  const [restaurantRes, videoRes, reviewRes, photoRes] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, city, created_at')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_PER_KIND),

    supabase
      .from('restaurant_videos')
      .select('id, restaurant_id, platform, created_at, restaurants!inner(name, city)')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_PER_KIND),

    supabase
      .from('reviews')
      .select('id, restaurant_id, created_at, restaurants!inner(name, city)')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_PER_KIND),

    supabase
      .from('review_photos')
      .select(
        'id, created_at, reviews!inner(restaurant_id, restaurants!inner(name, city))'
      )
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_PER_KIND),
  ])

  const events: FeedEvent[] = []

  for (const row of restaurantRes.data ?? []) {
    events.push({
      id: `restaurant-${row.id}`,
      kind: 'restaurant_added',
      timestamp: row.created_at,
      restaurant_id: row.id,
      restaurant_name: row.name,
      restaurant_city: row.city ?? null,
    })
  }

  // Group videos by (restaurant_id, day) so we emit "5 new TikToks for
  // Lucali" as a single card instead of five.
  const videoBuckets = new Map<
    string,
    {
      restaurant_id: string
      restaurant_name: string
      restaurant_city: string | null
      platform: 'tiktok' | 'instagram'
      count: number
      latestTimestamp: string
    }
  >()

  for (const row of videoRes.data ?? []) {
    const rel = extractRelation<{ name: string; city: string | null }>(
      (row as unknown as { restaurants: unknown }).restaurants
    )
    if (!rel) continue
    const platform = row.platform === 'instagram' ? 'instagram' : 'tiktok'
    const day = isoDay(new Date(row.created_at))
    const key = `${row.restaurant_id}|${platform}|${day}`
    const bucket = videoBuckets.get(key)
    if (bucket) {
      bucket.count += 1
      if (row.created_at > bucket.latestTimestamp) {
        bucket.latestTimestamp = row.created_at
      }
    } else {
      videoBuckets.set(key, {
        restaurant_id: row.restaurant_id,
        restaurant_name: rel.name,
        restaurant_city: rel.city,
        platform,
        count: 1,
        latestTimestamp: row.created_at,
      })
    }
  }

  for (const [key, bucket] of videoBuckets) {
    events.push({
      id: `videos-${key}`,
      kind: 'videos_added',
      timestamp: bucket.latestTimestamp,
      restaurant_id: bucket.restaurant_id,
      restaurant_name: bucket.restaurant_name,
      restaurant_city: bucket.restaurant_city,
      count: bucket.count,
      platform: bucket.platform,
    })
  }

  for (const row of reviewRes.data ?? []) {
    const rel = extractRelation<{ name: string; city: string | null }>(
      (row as unknown as { restaurants: unknown }).restaurants
    )
    if (!rel) continue
    events.push({
      id: `review-${row.id}`,
      kind: 'review_added',
      timestamp: row.created_at,
      restaurant_id: row.restaurant_id,
      restaurant_name: rel.name,
      restaurant_city: rel.city,
    })
  }

  // Photos are nested: review_photos -> reviews -> restaurants
  for (const row of photoRes.data ?? []) {
    const reviewRel = extractRelation<{
      restaurant_id: string
      restaurants: unknown
    }>((row as unknown as { reviews: unknown }).reviews)
    if (!reviewRel) continue
    const restaurantRel = extractRelation<{ name: string; city: string | null }>(
      reviewRel.restaurants
    )
    if (!restaurantRel) continue
    events.push({
      id: `photo-${row.id}`,
      kind: 'photos_added',
      timestamp: row.created_at,
      restaurant_id: reviewRel.restaurant_id,
      restaurant_name: restaurantRel.name,
      restaurant_city: restaurantRel.city,
    })
  }

  events.sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0
  )
  return events
}

/**
 * Split a sorted list of events into the four sections the feed renders.
 * "Today" = today's date (local), "Yesterday" = day before, "This week" =
 * last 7 days minus today/yesterday, "Earlier" = everything older.
 */
export interface GroupedEvents {
  today: FeedEvent[]
  yesterday: FeedEvent[]
  thisWeek: FeedEvent[]
  earlier: FeedEvent[]
}

export function groupEventsByDay(
  events: FeedEvent[],
  now: Date = new Date()
): GroupedEvents {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()
  const startOfYesterday = startOfToday - 24 * 3600 * 1000
  const startOfWeek = startOfToday - 7 * 24 * 3600 * 1000

  const groups: GroupedEvents = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }

  for (const ev of events) {
    const t = new Date(ev.timestamp).getTime()
    if (t >= startOfToday) groups.today.push(ev)
    else if (t >= startOfYesterday) groups.yesterday.push(ev)
    else if (t >= startOfWeek) groups.thisWeek.push(ev)
    else groups.earlier.push(ev)
  }
  return groups
}

// ---------- helpers ----------

/**
 * Supabase nested relation shape is either an object or an array depending
 * on whether the relation is many-to-one or one-to-many. For the joins we
 * use in this file they're always many-to-one, so we expect objects, but
 * we defensively unwrap arrays too.
 */
function extractRelation<T>(rel: unknown): T | null {
  if (!rel) return null
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null
  return rel as T
}
