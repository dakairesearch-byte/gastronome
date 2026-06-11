'use client'

/**
 * HitListCard — a single entry in the Hit List.
 *
 * Responsibilities:
 *   - Render the restaurant name/cuisine/neighborhood as a compact row.
 *   - Expose a "Been there ✓" action that calls submit_verdict (Been tier
 *     = RPC call with only p_restaurant_id) via Supabase, then fires the
 *     onCrossOff callback so the parent can animate + remove the card.
 *   - Animate itself out with a CSS height-collapse transition (no lib).
 *   - Gate the RPC call behind auth: unauthenticated tap opens the
 *     sign-in modal (same mechanism as BookmarkButton / Navigation).
 *
 * Design: mobile-first, 44px touch targets, garnet action color, warm
 * card surface matching the rest of the saved page aesthetic.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Restaurant } from '@/types/database'

interface HitListCardProps {
  restaurant: Restaurant
  /** Called after the cross-off animation completes so the parent removes the card from state. */
  onCrossOff: (restaurantId: string) => void
  /** Called immediately on cross-off (before animation) to show the undo toast. */
  onCrossOffStart: (restaurantId: string) => void
}

export default function HitListCard({
  restaurant,
  onCrossOff,
  onCrossOffStart,
}: HitListCardProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [crossing, setCrossing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Track auth state — same pattern as BookmarkButton.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      try {
        listener?.subscription?.unsubscribe?.()
      } catch {
        /* swallow */
      }
    }
  }, [])

  const handleBeenThere = async () => {
    if (!user) {
      openSignInModal({ mode: 'signin' })
      return
    }
    if (busy || crossing) return

    setBusy(true)
    const supabase = createClient()
    // Been = partial call with only p_restaurant_id (merges into existing
    // verdict). Optional params are omitted — SQL defaults apply.
    const { error } = await supabase.rpc('submit_verdict', {
      p_restaurant_id: restaurant.id,
    })
    setBusy(false)

    if (error) {
      // RPC failed — do not animate out; surface error silently (no guilt).
      console.error('[HitListCard] submit_verdict failed:', error)
      return
    }

    // Kick off the removal: notify parent immediately for the undo toast,
    // then start the CSS collapse animation.
    onCrossOffStart(restaurant.id)
    setCrossing(true)
  }

  // When the CSS transition ends, tell the parent to remove this card from
  // the list. We listen to 'transitionend' on the card element to catch the
  // moment the collapse finishes rather than guessing a timeout.
  useEffect(() => {
    if (!crossing) return
    const el = cardRef.current
    if (!el) {
      onCrossOff(restaurant.id)
      return
    }
    const handleEnd = (e: TransitionEvent) => {
      // Only the root's own height collapse counts: the opacity transition
      // ends earlier (250ms vs 350ms), and transitionend events from child
      // elements (e.g. the button's color transition) bubble up here too.
      if (e.target !== el || e.propertyName !== 'grid-template-rows') return
      onCrossOff(restaurant.id)
    }
    el.addEventListener('transitionend', handleEnd)
    return () => el.removeEventListener('transitionend', handleEnd)
  }, [crossing, restaurant.id, onCrossOff])

  const cuisine = restaurant.cuisine ?? null
  const neighborhood = restaurant.neighborhood ?? restaurant.city ?? null

  return (
    <div
      ref={cardRef}
      // (No aria-label here — ARIA prohibits naming generic divs, and the
      // card's content already carries the restaurant name. The cross-off is
      // announced by the parent's role="status" undo toast.)
      // Height collapse: when crossing=true we collapse the natural height to 0
      // with overflow hidden. The `grid-rows` trick lets us animate to height 0
      // without knowing the explicit pixel height.
      style={{
        display: 'grid',
        gridTemplateRows: crossing ? '0fr' : '1fr',
        opacity: crossing ? 0 : 1,
        transition: 'grid-template-rows 350ms ease, opacity 250ms ease',
        overflow: 'hidden',
      }}
    >
      {/* Inner wrapper is needed for the grid-rows height-collapse trick */}
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          {/* Restaurant info — links to the detail page */}
          <Link
            href={`/restaurants/${restaurant.id}`}
            className="flex-1 min-w-0 group"
            tabIndex={0}
          >
            <p
              className="font-semibold text-sm leading-snug truncate group-hover:underline"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {restaurant.name}
            </p>
            {(cuisine || neighborhood) && (
              <p
                className="text-xs mt-0.5 flex items-center gap-1 truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {neighborhood && (
                  <>
                    <MapPin size={10} aria-hidden="true" className="flex-shrink-0" />
                    <span className="truncate">{neighborhood}</span>
                  </>
                )}
                {cuisine && neighborhood && (
                  <span aria-hidden="true" className="mx-0.5">·</span>
                )}
                {cuisine && <span className="truncate">{cuisine}</span>}
              </p>
            )}
          </Link>

          {/* Been there button — min 44px touch target */}
          <button
            type="button"
            onClick={handleBeenThere}
            disabled={busy}
            aria-label={`Mark ${restaurant.name} as visited`}
            title="Been there"
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              background: 'var(--color-action)',
              color: 'var(--color-on-action)',
            }}
          >
            <CheckCircle size={14} aria-hidden="true" className="flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Been there</span>
          </button>
        </div>
      </div>
    </div>
  )
}
