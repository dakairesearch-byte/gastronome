'use client'

/**
 * DuelPrompt — "Which was better?" two-card chooser.
 *
 * Rules (Engagement Gate compliant):
 *  - Only appears in the VerdictSheet done state, once per sheet session.
 *  - The challenger is ONE same-city restaurant the user has already Been to.
 *  - Always skippable via "Maybe later" — no guilt copy, no loss framing.
 *  - Fires submit_comparison RPC on a choice; silently succeeds/fails
 *    (the logged verdict is already saved; this is bonus signal only).
 *
 * Props:
 *  - restaurantId / restaurantName: the restaurant just logged.
 *  - restaurantCity: city string from the restaurant row (null = no prompt).
 *  - userId: caller's auth uid (null = no prompt — never show to anon).
 *  - onDismiss: called when the user skips or after a successful choice.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DuelRestaurant {
  id: string
  name: string
  cuisine: string | null
  neighborhood: string | null
  photo_url: string | null
  google_photo_url: string | null
}

interface DuelPromptProps {
  restaurantId: string
  restaurantName: string
  restaurantCity: string | null
  userId: string | null
  onDismiss: () => void
}

type PromptState = 'loading' | 'ready' | 'choosing' | 'done' | 'skip'

export default function DuelPrompt({
  restaurantId,
  restaurantName,
  restaurantCity,
  userId,
  onDismiss,
}: DuelPromptProps) {
  const [state, setState] = useState<PromptState>('loading')
  const [challenger, setChallenger] = useState<DuelRestaurant | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Latest onDismiss without re-running the lookup effect when the parent
  // re-renders (it passes a fresh closure each render).
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    let active = true

    // No viable duel: render nothing AND hand control back to the sheet
    // (via onDismiss) so its Close button reappears. Without this, the
    // done state would lose its primary CTA whenever the duel silently
    // skips. Always called from a deferred context (timeout / post-await),
    // never synchronously in the effect body.
    const skip = () => {
      if (!active) return
      setState('skip')
      onDismissRef.current()
    }

    if (!userId || !restaurantCity) {
      const t = window.setTimeout(skip, 0)
      return () => {
        active = false
        window.clearTimeout(t)
      }
    }

    const supabase = createClient()

    // Fetch own Been verdicts for same-city restaurants,
    // excluding the just-logged restaurant.
    // Uses own-row SELECT policy (author_id = auth.uid()).
    ;(async () => {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('restaurant_id')
        .eq('author_id', userId)
        .neq('restaurant_id', restaurantId)
        .limit(1000)

      if (!active) return
      if (!reviews || reviews.length === 0) {
        skip()
        return
      }

      const visitedIds = reviews.map((r) => r.restaurant_id)

      // Find same-city candidates among visited restaurants
      const { data: candidates } = await supabase
        .from('restaurants')
        .select('id, name, cuisine, neighborhood, photo_url, google_photo_url, city')
        .in('id', visitedIds)
        .eq('city', restaurantCity)
        .neq('id', restaurantId)
        .limit(50)

      if (!active) return
      if (!candidates || candidates.length === 0) {
        skip()
        return
      }

      // Pick a random candidate from top-50 to avoid always picking the same one
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      setChallenger(pick as DuelRestaurant)
      setState('ready')
    })()

    return () => {
      active = false
    }
  }, [userId, restaurantId, restaurantCity])

  const handleChoice = useCallback(
    async (winnerId: string, loserId: string) => {
      setSubmitting(true)
      setState('choosing')
      const supabase = createClient()
      // Fire and forget — the verdict is already saved; comparison is bonus signal.
      // p_context omitted (optional param — omit rather than pass null per RPC conventions).
      await supabase.rpc('submit_comparison', {
        p_winner_id: winnerId,
        p_loser_id: loserId,
      })
      setSubmitting(false)
      setState('done')
      // Brief confirmation then dismiss
      window.setTimeout(() => {
        onDismiss()
      }, 900)
    },
    [onDismiss]
  )

  // Nothing to show in these states
  if (state === 'loading' || state === 'skip' || !challenger) return null

  if (state === 'done') {
    return (
      <div
        className="mt-5 pt-5"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <p
          className="text-center text-sm"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          Ranking saved.
        </p>
      </div>
    )
  }

  return (
    <div
      className="mt-5 pt-5"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <p
        className="text-xs uppercase mb-3 text-center tracking-widest"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
        }}
      >
        Which was better?
      </p>

      <div className="flex gap-3">
        {/* Current restaurant card */}
        <button
          type="button"
          onClick={() => !submitting && handleChoice(restaurantId, challenger.id)}
          disabled={submitting}
          aria-label={`${restaurantName} was better`}
          className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
          style={{
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          <div
            className="w-full rounded-md overflow-hidden"
            style={{ aspectRatio: '4/3', backgroundColor: 'var(--color-border)' }}
          >
            <RestaurantThumb name={restaurantName} photoUrl={null} />
          </div>
          <p
            className="text-xs font-semibold text-center leading-tight line-clamp-2"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
          >
            {restaurantName}
          </p>
        </button>

        {/* Challenger card */}
        <button
          type="button"
          onClick={() => !submitting && handleChoice(challenger.id, restaurantId)}
          disabled={submitting}
          aria-label={`${challenger.name} was better`}
          className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
          style={{
            border: '1.5px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          <div
            className="w-full rounded-md overflow-hidden"
            style={{ aspectRatio: '4/3', backgroundColor: 'var(--color-border)' }}
          >
            <RestaurantThumb
              name={challenger.name}
              photoUrl={challenger.google_photo_url ?? challenger.photo_url}
            />
          </div>
          <p
            className="text-xs font-semibold text-center leading-tight line-clamp-2"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
          >
            {challenger.name}
          </p>
        </button>
      </div>

      {/* Skip — no guilt copy */}
      <button
        type="button"
        onClick={onDismiss}
        disabled={submitting}
        className="mt-3 w-full text-sm py-2 transition-colors"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        Maybe later
      </button>
    </div>
  )
}

/** Simple photo-or-initial thumbnail used inside the duel cards. */
function RestaurantThumb({
  name,
  photoUrl,
}: {
  name: string
  photoUrl: string | null
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="w-full h-full object-cover"
      />
    )
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: 'rgba(142,59,70,0.08)' }}
    >
      <span
        className="text-2xl font-semibold"
        style={{ color: 'var(--color-action)', fontFamily: 'var(--font-heading)' }}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
