'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { GastronomeScore } from '@/lib/score'

/**
 * ScorePill — the reusable, compact Gastronome Score badge that appears
 * on cards across the app (the namesake number finally rendered where
 * users browse, not just on the detail hero). SHARED CONTRACT: imported
 * by the card components.
 *
 *  - `score`: the 0–10 number, or null. Returns null when null — a
 *    restaurant with no rating source shows nothing rather than a
 *    fabricated "0".
 *  - `size`: "sm" (default) is the corner/inline card pill; "md" is a
 *    slightly larger variant for denser hero rows.
 *
 * Design tokens only (var(--color-*)) so a rebrand flows through. No
 * tooltip here — the methodology popover lives on the detail hero badge
 * (GastronomeScoreBadge) to keep cards lightweight.
 */
export function ScorePill({
  score,
  size = 'sm',
}: {
  score: number | null
  size?: 'sm' | 'md'
}) {
  if (score == null) return null

  const isMd = size === 'md'

  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded-full font-bold leading-none shadow-sm ${
        isMd ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
      style={{
        backgroundColor: 'var(--color-secondary)',
        color: 'var(--color-surface)',
        fontFamily: 'var(--font-heading)',
      }}
      aria-label={`Gastronome Score ${score.toFixed(1)} out of 10`}
      title={`Gastronome Score ${score.toFixed(1)} / 10`}
    >
      {score.toFixed(1)}
      <span
        className={isMd ? 'text-[10px]' : 'text-[9px]'}
        style={{ color: 'var(--color-surface)', opacity: 0.6, fontWeight: 400 }}
        aria-hidden="true"
      >
        /10
      </span>
    </span>
  )
}

/**
 * Hero display for the Gastronome Score: a bold number out of 10 plus a
 * source count, with a methodology popover so the score is transparent
 * ("why is it 8.4?"). Renders on the restaurant detail hero over the
 * dark photo, so colors are tuned for a dark background.
 */
export default function GastronomeScoreBadge({
  score,
}: {
  score: GastronomeScore
}) {
  const [open, setOpen] = useState(false)
  // Touch fires a synthetic mouseenter immediately before the click. Without
  // this guard, hover-open would set open=true, then the click toggle would
  // flip it straight back to false — leaving touch users unable to open the
  // popover. We suppress hover-open for a short window after a touch start so
  // the click handler is the sole authority on touch devices, while pointer
  // (mouse) hover continues to open/close on desktop.
  const touchedRef = useRef(false)
  // Root wraps the trigger + popover so an outside-tap/click can be
  // detected (anything outside this node closes the popover).
  const rootRef = useRef<HTMLDivElement>(null)

  // While open: close on Escape, and on any pointer/touch outside the
  // root. Pointerdown (not click) so a tap that starts outside dismisses
  // immediately on touch, and capture so we beat any inner stopPropagation.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointerDown = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span
          className="text-3xl leading-none"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {score.score.toFixed(1)}
          <span
            className="text-base"
            style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}
          >
            {' '}
            / 10
          </span>
        </span>
        <button
          type="button"
          onTouchStart={() => {
            touchedRef.current = true
          }}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => {
            if (touchedRef.current) return
            setOpen(true)
          }}
          onMouseLeave={() => {
            if (touchedRef.current) {
              touchedRef.current = false
              return
            }
            setOpen(false)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label="How the Gastronome Score is calculated"
          aria-expanded={open}
          className="inline-flex items-center justify-center -m-3 p-3 min-w-[44px] min-h-[44px] rounded-full transition-colors"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <Info size={15} aria-hidden="true" />
        </button>
      </div>
      <span
        className="text-[11px] uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-body)' }}
      >
        Gastronome Score · {score.sourceCount} of {score.maxSources} sources
        {score.reviewCount != null && score.reviewCount > 0 && (
          <> · {score.reviewCount.toLocaleString()} reviews</>
        )}
      </span>

      {open && (
        <div
          role="tooltip"
          className="absolute top-full left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg shadow-2xl z-50 p-4 text-left"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          <p
            className="text-xs mb-2"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            A credibility-weighted blend of the rating sources we have for
            this place, each put on the same 0–10 scale. We weight by
            source, then renormalize over only the sources present — a
            missing source neither helps nor hurts. Awards (Michelin,
            James Beard, Eater) are shown separately and don&rsquo;t
            affect this number.
          </p>
          <p
            className="text-[11px] mb-3"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Based on {score.sourceCount} of {score.maxSources} sources
            {score.reviewCount != null && score.reviewCount > 0 && (
              <> across {score.reviewCount.toLocaleString()} reviews</>
            )}
            . Fewer sources means a thinner read — treat it accordingly.
          </p>
          <ul className="space-y-1.5">
            {score.breakdown.map((c) => (
              <li
                key={c.source}
                className="flex items-center justify-between text-xs"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span style={{ color: 'var(--color-text)' }}>
                  {c.source}
                  <span className="opacity-50">
                    {' '}
                    · {Math.round(c.weight * 100)}%
                  </span>
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {c.native.toFixed(1)} / {c.nativeMax}
                  <span className="opacity-60">
                    {' '}
                    → {c.normalized.toFixed(1)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
