'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import type { GastronomeScore } from '@/lib/score'

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

  return (
    <div className="relative inline-flex flex-col gap-0.5">
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
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label="How the Gastronome Score is calculated"
          aria-expanded={open}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <Info size={15} aria-hidden="true" />
        </button>
      </div>
      <span
        className="text-[11px] uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-body)' }}
      >
        Gastronome Score · {score.sourceCount}{' '}
        {score.sourceCount === 1 ? 'source' : 'sources'}
      </span>

      {open && (
        <div
          role="tooltip"
          className="absolute top-full left-0 mt-2 w-72 rounded-lg shadow-2xl z-50 p-4 text-left"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          <p
            className="text-xs mb-3"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            A credibility-weighted blend of every rating source we have,
            each put on the same 0–10 scale. Awards (Michelin, James
            Beard, Eater) are shown separately and don&rsquo;t affect this
            number.
          </p>
          <ul className="space-y-1.5">
            {score.breakdown.map((c) => (
              <li
                key={c.source}
                className="flex items-center justify-between text-xs"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span style={{ color: 'var(--color-text)' }}>{c.source}</span>
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
