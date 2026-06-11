'use client'

/**
 * RailImpressionTracker — client island that fires impression events
 * for a batch of restaurant cards on a given surface (rail).
 *
 * Renders nothing visible. Attaches an IntersectionObserver on mount
 * so events fire only when cards are actually scrolled into view.
 *
 * Usage: render once per rail, AFTER the card list, passing the ordered
 * array of restaurant IDs and the rail surface key.
 *
 * The actual card click events are wired separately in RailCard via
 * logFeedEvent('click').
 */

import { useEffect, useRef } from 'react'
import { logFeedEvent } from '@/lib/impressions'

interface RailImpressionTrackerProps {
  /** Surface key, e.g. "trending", "city-best", "for-your-tastes", "worth-a-look" */
  surface: string
  /** Ordered list of restaurant IDs matching the card order in the DOM */
  restaurantIds: string[]
  /** CSS selector used to find card elements — default '[data-rail-card]' */
  cardSelector?: string
}

export default function RailImpressionTracker({
  surface,
  restaurantIds,
  cardSelector = '[data-rail-card]',
}: RailImpressionTrackerProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof IntersectionObserver === 'undefined') return

    // Walk upward to find the section container with the cards.
    const section = container.closest('section') ?? container.parentElement
    if (!section) return

    const cards = Array.from(section.querySelectorAll(cardSelector))
    const fired = new Set<Element>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.has(entry.target)) {
            fired.add(entry.target)
            const idx = cards.indexOf(entry.target)
            if (idx === -1) continue
            const restaurantId = restaurantIds[idx]
            if (!restaurantId) continue
            logFeedEvent({ surface, position: idx, restaurantId, event: 'impression' })
          }
        }
      },
      { threshold: 0.5 }
    )

    for (const card of cards) observer.observe(card)

    return () => {
      observer.disconnect()
    }
  }, [surface, restaurantIds, cardSelector])

  return <span ref={containerRef} aria-hidden="true" style={{ display: 'none' }} />
}
