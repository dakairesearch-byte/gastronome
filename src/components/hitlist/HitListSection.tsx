'use client'

/**
 * HitListSection — the "Hit List" block rendered on the /saved page.
 *
 * Layout:
 *   - Up to 10 cards rendered as the active queue (numbered 1–10).
 *   - Any additional saves land in a collapsed "overflow shelf":
 *     a disclosure row showing "+N more saved for someday" that expands
 *     in-place to show those extra cards (no page navigation, no scroll jump).
 *   - Undo toast: after a cross-off the user has 5 s to undo
 *     (re-adds the favorite via toggleFavorite — it does NOT un-Been the
 *     verdict because a Been is intentional and low-stakes).
 *
 * Cross-off behavior:
 *   1. User taps "Been there ✓" on a card.
 *   2. HitListCard fires onCrossOffStart immediately → we show the undo toast.
 *   3. The card collapses with a CSS transition.
 *   4. HitListCard fires onCrossOff when the transition ends → we remove the
 *      restaurant from favorites via toggleFavorite (unfavorite = remove from
 *      the Hit List), then close the toast.
 *
 * The component receives the full list of resolved Restaurant rows in Hit
 * List order (most-recently-saved first, i.e. favorites array order) so
 * the parent (saved/page.tsx) owns data loading.
 */

import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import { toggleFavorite } from '@/lib/collections'
import HitListCard from './HitListCard'
import type { Restaurant } from '@/types/database'

const HIT_LIST_CAP = 10

interface HitListSectionProps {
  restaurants: Restaurant[]
}

interface UndoState {
  restaurantId: string
  restaurantName: string
  timerId: ReturnType<typeof setTimeout>
}

export default function HitListSection({ restaurants }: HitListSectionProps) {
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  // Per-restaurant remount counter. Bumped on undo-during-animation so the
  // mid-collapse HitListCard unmounts (cancelling its pending transitionend
  // removal) and remounts fresh and fully expanded.
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({})

  // HitListCard owns its own collapse animation via local `crossing` state.
  // The parent (saved/page.tsx) re-renders with the id removed from `restaurants`
  // once handleCrossOff calls toggleFavorite after the animation ends.
  const activeSlots = restaurants.slice(0, HIT_LIST_CAP)
  const overflowSlots = restaurants.slice(HIT_LIST_CAP)

  const handleCrossOffStart = useCallback(
    (restaurantId: string) => {
      const restaurant = restaurants.find((r) => r.id === restaurantId)
      if (!restaurant) return

      // Clear any existing undo timer so successive cross-offs don't race.
      if (undoState) {
        clearTimeout(undoState.timerId)
      }

      const timerId = setTimeout(() => {
        setUndoState(null)
      }, 5000)

      setUndoState({
        restaurantId,
        restaurantName: restaurant.name,
        timerId,
      })
    },
    [restaurants, undoState]
  )

  const handleCrossOff = useCallback(
    (restaurantId: string) => {
      // Remove from favorites (storage). The parent will re-render because
      // useFavorites() fires FAVORITES_EVENT → useSyncExternalStore re-reads.
      toggleFavorite(restaurantId)
    },
    []
  )

  const handleUndo = useCallback(() => {
    if (!undoState) return
    clearTimeout(undoState.timerId)
    const { restaurantId } = undoState
    // Two cases, distinguished by whether the restaurant is still listed:
    //   a) Animation still in progress (< 350 ms) — handleCrossOff hasn't
    //      fired yet, so the restaurant is still in favorites. Toggling
    //      here would REMOVE it (the opposite of undo), and the pending
    //      transitionend would never fire to re-add it (the card unmounts
    //      when favorites change). Instead, bump the card's reset key: the
    //      mid-collapse card unmounts (its transitionend — and the removal
    //      it triggers — never fires) and remounts fresh. Favorites were
    //      never touched, so the state is exactly as before the cross-off.
    //   b) Animation finished — handleCrossOff already removed the favorite.
    //      toggleFavorite re-adds it and the card re-appears.
    const stillListed = restaurants.some((r) => r.id === restaurantId)
    if (stillListed) {
      setResetKeys((m) => ({ ...m, [restaurantId]: (m[restaurantId] ?? 0) + 1 }))
    } else {
      toggleFavorite(restaurantId)
    }
    setUndoState(null)
  }, [undoState, restaurants])

  if (restaurants.length === 0) return null

  return (
    <section aria-labelledby="hitlist-heading" className="relative">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <ListChecks
          size={18}
          aria-hidden="true"
          style={{ color: 'var(--color-action)' }}
        />
        <h2
          id="hitlist-heading"
          className="text-lg font-semibold"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          Hit List
        </h2>
        <span
          className="text-sm font-normal"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label={`${restaurants.length} restaurants`}
        >
          {restaurants.length}
        </span>
      </div>

      {/* Active slots (up to 10) */}
      {activeSlots.length > 0 ? (
        <ol className="space-y-2" aria-label="Want-to-go queue">
          {activeSlots.map((r) => (
            <li key={`${r.id}:${resetKeys[r.id] ?? 0}`}>
              <HitListCard
                restaurant={r}
                onCrossOffStart={handleCrossOffStart}
                onCrossOff={handleCrossOff}
              />
            </li>
          ))}
        </ol>
      ) : (
        // All active slots crossed off — show a gentle empty nudge.
        <p
          className="text-sm py-6 text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Your active slots are clear — save more places to visit.
        </p>
      )}

      {/* Overflow shelf */}
      {overflowSlots.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-expanded={overflowOpen}
            aria-controls="hitlist-overflow"
            className="inline-flex items-center gap-1.5 text-sm py-2 px-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors"
            style={{ color: 'var(--color-text-secondary)', minHeight: '44px' }}
          >
            {overflowOpen ? (
              <ChevronUp size={14} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
            {overflowOpen
              ? 'Hide someday list'
              : `+${overflowSlots.length} more saved for someday`}
          </button>

          {overflowOpen && (
            <ol
              id="hitlist-overflow"
              className="mt-2 space-y-2"
              aria-label="Someday list"
            >
              {overflowSlots.map((r) => (
                <li key={`${r.id}:${resetKeys[r.id] ?? 0}`}>
                  <HitListCard
                    restaurant={r}
                    onCrossOffStart={handleCrossOffStart}
                    onCrossOff={handleCrossOff}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Undo toast — fixed bottom center on mobile, inline-bottom on desktop */}
      {undoState && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm whitespace-nowrap sm:absolute sm:bottom-auto sm:top-full sm:mt-2 sm:left-0 sm:translate-x-0"
          style={{
            background: 'var(--color-secondary)',
            color: '#fff',
          }}
        >
          <span>
            <span aria-hidden="true">✓</span>{' '}
            Marked {undoState.restaurantName} as visited
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            aria-label="Undo Been there"
            style={{ minHeight: '44px', paddingInline: '4px' }}
          >
            Undo
          </button>
        </div>
      )}
    </section>
  )
}
