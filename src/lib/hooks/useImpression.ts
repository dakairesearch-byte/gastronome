'use client'

/**
 * useImpression — IntersectionObserver hook that fires an 'impression' event
 * exactly once when a card element is >= 50% visible in the viewport.
 *
 * Usage:
 *   const ref = useImpression({ surface: 'home_trending', position: 2, restaurantId: r.id })
 *   return <div ref={ref}>...</div>
 *
 * Behaviour:
 *   - Fires logFeedEvent({ event: 'impression', ... }) once per mount.
 *   - Disconnects the observer immediately after firing so the event is
 *     never sent twice for the same card instance, even if the card scrolls
 *     out and back into view.
 *   - SSR-safe: IntersectionObserver is only constructed client-side. The
 *     returned ref is a stable React ref in all environments.
 *   - Does nothing if restaurantId is falsy — avoids firing for skeleton
 *     placeholder cards before data has loaded.
 */

import { useEffect, useRef } from 'react'
import { logFeedEvent } from '@/lib/impressions'

interface UseImpressionOptions {
  /** Surface label passed to logFeedEvent (e.g. 'home_trending', 'discover_grid'). */
  surface: string
  /** Zero-based position of the card in its rail/list. */
  position: number
  /** The restaurant UUID. If empty/null, the hook is a no-op. */
  restaurantId: string | null | undefined
}

/**
 * Returns a ref to attach to the card's root element. The impression event
 * is fired once when >= 50% of the element is intersecting the viewport.
 */
export function useImpression<T extends Element = HTMLDivElement>(
  options: UseImpressionOptions
): React.RefObject<T | null> {
  const { surface, position, restaurantId } = options
  const ref = useRef<T | null>(null)
  // Track whether we have already fired so a second intersection (after
  // re-mount within the same session) is silently ignored.
  const firedRef = useRef(false)

  useEffect(() => {
    // Guard: no restaurantId, or server environment — do nothing.
    if (!restaurantId) return
    if (typeof IntersectionObserver === 'undefined') return

    const element = ref.current
    if (!element) return

    // Reset the fired flag on each mount cycle so that if the component is
    // unmounted and remounted (e.g. virtualised list) a fresh impression is
    // recorded for the new mount.
    firedRef.current = false

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true
            logFeedEvent({ surface, position, restaurantId, event: 'impression' })
            // Disconnect immediately — we never want to fire more than once.
            observer.disconnect()
          }
        }
      },
      {
        // 50% visibility threshold matches the spec requirement.
        threshold: 0.5,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [surface, position, restaurantId])

  return ref
}
