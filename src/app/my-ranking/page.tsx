/**
 * /my-ranking — the user's personal ranked list.
 *
 * Ranks the places they have Been to, sorted by:
 *   1. Their rating descending (null ratings go last).
 *   2. Among ties, duel wins for the pair are used as a tiebreaker
 *      (client-side pass over their own restaurant_comparisons rows).
 *
 * Server component: reads own reviews + comparisons via the server client.
 * RLS ensures each user sees only their own rows.
 *
 * Sign-in required: unauthenticated visitors are redirected to the
 * home page with a `?signin=1` hint (same pattern used by onboarding).
 *
 * Crowd Rank: intentionally NOT rendered here. Public Elo ladder is
 * metric-gated (Phase-2 owner decision). This page shows only the
 * user's own personal ranking.
 *
 * Stage 5 — duels lane — 2026-06-10
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRestaurantPhotoUrl } from '@/lib/restaurant'
import type { Restaurant } from '@/types/database'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'My Ranking — Gastronome',
  description: 'Your personal ranked list of places you have been.',
}

// Minimal restaurant shape returned from our select.
// Must include all PhotoFields columns used by getRestaurantPhotoUrl.
type RestaurantRow = Pick<
  Restaurant,
  | 'id'
  | 'name'
  | 'cuisine'
  | 'city'
  | 'neighborhood'
  | 'photo_url'
  | 'google_photo_url'
  | 'yelp_photo_url'
  | 'image_url'
  | 'photo_urls'
  | 'website_photo_url'
>

interface ReviewRow {
  restaurant_id: string
  rating: number | null
  would_return: boolean | null
  created_at: string | null
}

interface ComparisonRow {
  winner_id: string
  loser_id: string
}

interface RankedEntry {
  restaurant: RestaurantRow
  rating: number | null
  would_return: boolean | null
  wins: number
  losses: number
}

export default async function MyRankingPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/?signin=1')
  }

  // 1. Fetch own reviews (own-row SELECT policy: author_id = auth.uid())
  const { data: reviews } = await supabase
    .from('reviews')
    .select('restaurant_id, rating, would_return, created_at')
    .eq('author_id', user.id)
    .limit(1000)

  const reviewRows = (reviews ?? []) as ReviewRow[]

  if (reviewRows.length === 0) {
    return <EmptyRanking />
  }

  // 2. Fetch restaurant details for all visited IDs (paginated at 1000)
  const restaurantIds = reviewRows.map((r) => r.restaurant_id)
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, cuisine, city, neighborhood, photo_url, google_photo_url, yelp_photo_url, image_url, photo_urls, website_photo_url')
    .in('id', restaurantIds)
    .limit(1000)

  const restaurantMap = new Map<string, RestaurantRow>()
  for (const r of (restaurants ?? []) as RestaurantRow[]) {
    restaurantMap.set(r.id, r)
  }

  // 3. Fetch own comparisons for duel-win tiebreaker
  //    Public SELECT policy on restaurant_comparisons — filter by user_id.
  const { data: comparisons } = await supabase
    .from('restaurant_comparisons')
    .select('winner_id, loser_id')
    .eq('user_id', user.id)
    .limit(1000)

  const compRows = (comparisons ?? []) as ComparisonRow[]

  // Build win/loss counts per restaurant
  const winsMap = new Map<string, number>()
  const lossesMap = new Map<string, number>()
  for (const c of compRows) {
    winsMap.set(c.winner_id, (winsMap.get(c.winner_id) ?? 0) + 1)
    lossesMap.set(c.loser_id, (lossesMap.get(c.loser_id) ?? 0) + 1)
  }

  // 4. Build ranked entries — only include restaurants that exist in our map
  const entries: RankedEntry[] = reviewRows
    .filter((r) => restaurantMap.has(r.restaurant_id))
    .map((r) => ({
      restaurant: restaurantMap.get(r.restaurant_id)!,
      rating: r.rating,
      would_return: r.would_return,
      wins: winsMap.get(r.restaurant_id) ?? 0,
      losses: lossesMap.get(r.restaurant_id) ?? 0,
    }))

  // 5. Sort: rating desc (nulls last), then duel wins desc, then name asc
  entries.sort((a, b) => {
    const ra = a.rating ?? -1
    const rb = b.rating ?? -1
    if (rb !== ra) return rb - ra
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.restaurant.name.localeCompare(b.restaurant.name)
  })

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <p
            className="text-xs uppercase mb-2"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.16em',
              fontWeight: 500,
            }}
          >
            Personal ranking
          </p>
          <h1
            className="text-4xl"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            My Ranking
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {entries.length} {entries.length === 1 ? 'place' : 'places'} you&rsquo;ve been,
            sorted by your rating and duel wins.
          </p>
        </header>

        <ol className="space-y-3">
          {entries.map((entry, idx) => (
            <RankingRow key={entry.restaurant.id} entry={entry} rank={idx + 1} />
          ))}
        </ol>
      </div>
    </div>
  )
}

function RankingRow({ entry, rank }: { entry: RankedEntry; rank: number }) {
  const { restaurant, rating, would_return, wins, losses } = entry
  const photo = getRestaurantPhotoUrl(restaurant)

  return (
    <li>
      <Link
        href={`/restaurants/${restaurant.id}`}
        className="flex items-center gap-4 p-4 rounded-sm transition-all hover:shadow-sm"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Rank number */}
        <span
          className="flex-shrink-0 w-8 text-center text-sm font-semibold"
          style={{
            color: rank <= 3 ? 'var(--color-action)' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          {rank}
        </span>

        {/* Photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt={restaurant.name}
          className="w-14 h-14 object-cover rounded-sm flex-shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-sm font-medium"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
          >
            {restaurant.name}
          </p>
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            {[restaurant.neighborhood, restaurant.city].filter(Boolean).join(' · ')}
          </p>
          {/* Duel record if any comparisons exist */}
          {(wins > 0 || losses > 0) && (
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              {wins}W {losses}L in duels
            </p>
          )}
        </div>

        {/* Rating + would-return badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {rating !== null ? (
            <span
              className="text-lg font-semibold"
              style={{ color: 'var(--color-action)', fontFamily: 'var(--font-heading)' }}
            >
              {rating}
            </span>
          ) : (
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              No rating
            </span>
          )}
          {would_return === true && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(142,59,70,0.10)',
                color: 'var(--color-action)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
              }}
            >
              Would return
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

function EmptyRanking() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="text-center max-w-sm">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: 'rgba(142,59,70,0.10)' }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--color-action)' }}
            aria-hidden="true"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </div>
        <h2
          className="text-2xl mb-2"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}
        >
          No visits yet
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          Log a visit on any restaurant page and it will appear here, ranked by your own ratings.
        </p>
        <Link
          href="/discover"
          className="inline-block px-6 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
          }}
        >
          Discover restaurants
        </Link>
      </div>
    </div>
  )
}
