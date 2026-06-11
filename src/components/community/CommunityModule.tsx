/**
 * CommunityModule — server component.
 *
 * Renders the community signal block under the score/verdict cards:
 *  - "% would return · N diners" headline (gate: n_return_asked ≥ 5)
 *  - Community mean + confidence dots (gate: weighted_n ≥ 5 AND n_ratings ≥ 3)
 *  - Below gates: up to 3 named verdicts (username: rating — would/would not return)
 *  - Nothing when no data exists
 *
 * Reads: restaurant_community_stats, reviews joined to profiles.
 * Never fakes aggregate numbers below gate thresholds.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  shouldShowCommunityScore,
  shouldShowReturnRate,
  fuzzyBand,
  confidenceDots,
  formatReturnRate,
  type CommunityStats,
} from '@/lib/community'

interface CommunityModuleProps {
  restaurantId: string
}

interface NamedVerdict {
  username: string
  rating: number | null
  would_return: boolean | null
}

export default async function CommunityModule({ restaurantId }: CommunityModuleProps) {
  const supabase = await createServerSupabaseClient()

  // Parallel: community stats + recent named verdicts
  const [statsResult, verdictsResult] = await Promise.all([
    supabase
      .from('restaurant_community_stats')
      .select(
        'n_been,n_return_asked,n_return_yes,n_ratings,weighted_n,mean_raw,mean_calibrated,ci_halfwidth,elo,n_comparisons,computed_at'
      )
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
    // Named verdicts: join reviews to profiles for username. Been-only
    // rows (no rating, no would_return) carry no displayable verdict and
    // are filtered out server-side so they don't consume the limit(3).
    supabase
      .from('reviews')
      .select('rating, would_return, author_id, profiles!inner(username)')
      .eq('restaurant_id', restaurantId)
      .eq('quarantined', false)
      .or('rating.not.is.null,would_return.not.is.null')
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const stats = statsResult.data as CommunityStats | null
  // Supabase join can return profiles as object OR array[0] (depends on SDK/query shape)
  function extractProfile(rel: unknown): { username: string } | null {
    if (!rel) return null
    if (Array.isArray(rel)) return (rel[0] as { username: string } | undefined) ?? null
    return rel as { username: string }
  }

  const rawVerdicts = (verdictsResult.data ?? []) as Array<{
    rating: number | null
    would_return: boolean | null
    author_id: string
    profiles: unknown
  }>

  const namedVerdicts: NamedVerdict[] = rawVerdicts
    .map((v) => ({ ...v, _profile: extractProfile(v.profiles) }))
    .filter((v) => v._profile?.username)
    .map((v) => ({
      username: v._profile!.username,
      rating: v.rating,
      would_return: v.would_return,
    }))

  // Nothing to show
  const hasStats = stats != null && stats.n_been > 0
  const showReturnRate = hasStats && shouldShowReturnRate(stats!)
  const showScore = hasStats && shouldShowCommunityScore(stats!)
  const showNamedVerdicts = !showScore && namedVerdicts.length > 0

  if (!hasStats && namedVerdicts.length === 0) return null

  const returnRateLabel = showReturnRate ? formatReturnRate(stats!) : null
  const dots = showScore ? confidenceDots(stats!) : 0

  return (
    <section aria-label="Community verdicts">
      <div className="mb-3">
        <span
          className="text-xs uppercase block mb-2.5"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.18em',
            fontWeight: 500,
          }}
        >
          From diners
        </span>
        <h2
          className="text-2xl"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            color: 'var(--color-text)',
            letterSpacing: '-0.005em',
          }}
        >
          Community
        </h2>
        <div
          className="mt-3"
          style={{ width: 48, height: 1, backgroundColor: 'var(--color-accent)' }}
        />
      </div>

      <div
        className="px-4 py-4 rounded-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Aggregate stats row (when gates met) */}
        {(showScore || showReturnRate) && (
          <div className="flex flex-wrap items-center gap-5 mb-4">
            {showScore && stats && (
              <div className="flex items-end gap-2">
                <span
                  className="text-3xl"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    lineHeight: 1,
                  }}
                >
                  {stats.mean_calibrated?.toFixed(1)}
                </span>
                <div className="flex flex-col gap-0.5 pb-0.5">
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                  >
                    community mean
                  </span>
                  {/* Confidence dots */}
                  {dots > 0 && (
                    <div className="flex items-center gap-0.5" aria-label={`Confidence: ${dots} of 3`}>
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '999px',
                            backgroundColor:
                              i <= dots ? 'var(--color-action)' : 'var(--color-border)',
                          }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showReturnRate && returnRateLabel && (
              <div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
                >
                  {returnRateLabel.split(' · ')[0]}
                </span>
                <span
                  className="text-xs ml-1.5"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  would return
                </span>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  {fuzzyBand(stats!.n_return_asked)} diners asked
                </p>
              </div>
            )}
          </div>
        )}

        {/* Named verdicts — only when aggregate gates not met */}
        {showNamedVerdicts && (
          <ul className="space-y-2.5">
            {namedVerdicts.map((v, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 text-sm"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}
              >
                <span
                  className="inline-flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '999px',
                    backgroundColor: 'rgba(142,59,70,0.10)',
                    color: 'var(--color-action)',
                    fontFamily: 'var(--font-heading)',
                  }}
                  aria-hidden="true"
                >
                  {v.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate font-medium">{v.username}</span>
                {v.rating != null && (
                  <span
                    className="flex-shrink-0 text-sm font-semibold"
                    style={{ color: 'var(--color-action)' }}
                  >
                    {v.rating}
                  </span>
                )}
                {v.would_return != null && (
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    — {v.would_return ? 'would go back' : 'would not return'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Been count (always shown when stats exist) */}
        {hasStats && stats && stats.n_been > 0 && (
          <p
            className="text-xs mt-3 pt-3"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              borderTop: (showScore || showReturnRate || showNamedVerdicts) ? '1px solid var(--color-border)' : 'none',
            }}
          >
            {fuzzyBand(stats.n_been)} diner{stats.n_been !== 1 ? 's' : ''} {stats.n_been === 1 ? 'has' : 'have'} been here
          </p>
        )}
      </div>
    </section>
  )
}
