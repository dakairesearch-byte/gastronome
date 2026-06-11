'use client'

/**
 * BackfillGrid — "Been anywhere here?" onboarding step.
 *
 * Shown as an optional step after account creation succeeds (active session
 * only — skipped entirely for the email-confirm flow where no session exists
 * yet). Presents a compact tappable grid of the user's chosen city's top ~24
 * restaurants (by google_review_count) so they can mark multi-select Been
 * visits in one tap each, then batch-log them before landing on the homepage.
 *
 * Engagement-gate compliance:
 *   - No loss-framing, no guilt copy.
 *   - Prominently skippable ("Skip — I'll log later" link).
 *   - No contribution-volume metric shown.
 *   - No variable-ratio reward schedule.
 */

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Check, Loader2, MapPin } from 'lucide-react'
import { getRestaurantPhotoUrl } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant } from '@/types/database'

/** Minimal photo fields needed by getRestaurantPhotoUrl. */
type GridRestaurant = Pick<
  Restaurant,
  | 'id'
  | 'name'
  | 'cuisine'
  | 'photo_url'
  | 'google_photo_url'
  | 'yelp_photo_url'
  | 'image_url'
  | 'photo_urls'
  | 'website_photo_url'
>

interface BackfillGridProps {
  /** City name to fetch top restaurants for. Falls back to an empty fetch (no
   *  restaurants shown) if absent — the step stays skippable in that case. */
  city: string
  /** Authenticated Supabase client — required because submit_verdict is
   *  authenticated-only (anon grant revoked). Typed as the return value of
   *  createClient() to stay aligned with the app's client factory. */
  supabase: ReturnType<typeof createClient>
  /** Called after the user taps "Log N visits" (after all RPCs complete) or
   *  "Skip". Either way, onboarding advances to finish. */
  onDone: () => void
}

export default function BackfillGrid({ city, supabase, onDone }: BackfillGridProps) {
  const [restaurants, setRestaurants] = useState<GridRestaurant[]>([])
  // Loading only when there's a city to fetch for — avoids a synchronous
  // setState inside the fetch effect (react-hooks/set-state-in-effect).
  const [loading, setLoading] = useState(() => Boolean(city))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  /** How many Been RPCs have completed so far (used for a live progress count). */
  const [logged, setLogged] = useState(0)

  // Fetch top ~24 restaurants for the city on mount.
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!city) return
      const { data } = await supabase
        .from('restaurants')
        .select(
          'id, name, cuisine, photo_url, google_photo_url, yelp_photo_url, image_url, photo_urls, website_photo_url'
        )
        .eq('city', city)
        .eq('flagged_for_removal', false)
        .order('google_review_count', { ascending: false, nullsFirst: false })
        .limit(24)
      if (!active) return
      setRestaurants((data ?? []) as GridRestaurant[])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [supabase, city])

  const toggleRestaurant = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /** Fire submit_verdict (Been = only p_restaurant_id) for each selected
   *  restaurant sequentially, updating the progress counter as each resolves. */
  const handleLog = async () => {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    setLogged(0)
    const ids = Array.from(selected)
    for (const restaurantId of ids) {
      await supabase.rpc('submit_verdict', {
        p_restaurant_id: restaurantId,
        p_rating: null,
        p_would_return: null,
        p_dish_tags: null,
        p_ip: null,
        p_ua: null,
      })
      setLogged((n) => n + 1)
    }
    onDone()
  }

  const n = selected.size

  // While the initial fetch is in flight show a minimal loading state rather
  // than an empty grid, so the step doesn't feel broken on slow connections.
  if (loading) {
    return (
      <div className="text-center py-10">
        <Loader2
          size={20}
          className="animate-spin mx-auto"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Loading restaurants…"
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <p
          className="text-[10px] uppercase mb-3"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.16em',
            fontWeight: 600,
          }}
        >
          Optional — quick start
        </p>
        <h2
          className="text-2xl sm:text-3xl"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          Been anywhere here?
        </h2>
        <p
          className="text-sm mt-2 max-w-sm mx-auto"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            lineHeight: 1.6,
          }}
        >
          {city
            ? `Tap the spots you've visited in ${city}.`
            : `Tap the spots you've visited.`}
          {' '}Log them all in one go.
        </p>
      </div>

      {/* Grid — 3-col on mobile, 4-col on sm+ */}
      {restaurants.length > 0 ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}
          role="group"
          aria-label="Select restaurants you have visited"
        >
          {restaurants.map((r) => {
            const on = selected.has(r.id)
            const photoUrl = getRestaurantPhotoUrl(r)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRestaurant(r.id)}
                aria-pressed={on}
                disabled={submitting}
                className="relative overflow-hidden rounded-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
                style={{
                  aspectRatio: '1 / 1',
                  border: on
                    ? '2px solid var(--color-action)'
                    : '2px solid transparent',
                  outline: on ? 'none' : undefined,
                  /* 44px minimum touch target — the tile itself is ≥96px so this
                     is satisfied by the natural size alone. */
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                {/* Photo */}
                <Image
                  src={photoUrl}
                  alt={r.name}
                  fill
                  sizes="(max-width: 640px) 30vw, 120px"
                  className="object-cover"
                  onError={(e) => {
                    // Fall back to a plain background if the photo 404s.
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                {/* Dark scrim + name */}
                <div
                  className="absolute inset-0 flex items-end p-1.5"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 60%)',
                  }}
                >
                  <span
                    className="text-white text-[10px] leading-tight line-clamp-2 text-left w-full"
                    style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}
                  >
                    {r.name}
                  </span>
                </div>
                {/* Selected check overlay */}
                {on && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(142, 59, 70, 0.25)' }}
                    aria-hidden="true"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shadow"
                      style={{ backgroundColor: 'var(--color-action)' }}
                    >
                      <Check size={14} className="text-white" />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        /* No restaurants for this city — show an empty-state so the step isn't
           just a blank pane. The user can still skip. */
        <div
          className="py-8 text-center rounded-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
          }}
        >
          <MapPin
            size={20}
            className="mx-auto mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-hidden="true"
          />
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            No restaurants found — you can log visits from any restaurant page.
          </p>
        </div>
      )}

      {/* CTAs */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {/* Primary — only shown when something is selected */}
        {n > 0 && (
          <button
            type="button"
            onClick={handleLog}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 w-full max-w-xs px-6 py-3 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-action)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.14em',
              fontWeight: 500,
              minHeight: 44,
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {logged < n ? `Logging ${logged + 1} of ${n}…` : 'Done!'}
              </>
            ) : (
              <>
                <Check size={14} />
                Log {n} visit{n !== 1 ? 's' : ''}
              </>
            )}
          </button>
        )}

        {/* Skip — always visible */}
        <button
          type="button"
          onClick={onDone}
          disabled={submitting}
          className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Skip — I&apos;ll log later
        </button>
      </div>
    </div>
  )
}
