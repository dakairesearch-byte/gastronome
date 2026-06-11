'use client'

/**
 * FirstFork — honest empty-state card for restaurants with null/thin score data.
 *
 * Shows when:
 *   - gastronomeScore() returns null (no rating sources), OR
 *   - sourceCount is thin (only 1 of N possible sources)
 *
 * "Be the first fork" CTA opens the VerdictSheet.
 * Never shows fake numbers.
 *
 * @prop restaurantId    - restaurant UUID
 * @prop restaurantName  - display name
 * @prop sourceCount     - how many rating sources actually contributed (0–4)
 * @prop maxSources      - total possible sources (usually 4)
 * @prop topDishes       - dish options for the VerdictSheet
 * @prop className       - optional outer class
 */

import { useState } from 'react'
import { Utensils } from 'lucide-react'
import VerdictSheet from './verdict/VerdictSheet'

interface FirstForkProps {
  restaurantId: string
  restaurantName: string
  sourceCount: number
  maxSources: number
  topDishes?: string[]
  className?: string
  onVerdictSaved?: () => void
  /** City forwarded to the VerdictSheet duel prompt. Omit to suppress duels. */
  restaurantCity?: string | null
}

export default function FirstFork({
  restaurantId,
  restaurantName,
  sourceCount,
  maxSources,
  topDishes = [],
  className = '',
  onVerdictSaved,
  restaurantCity,
}: FirstForkProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const sourcesLabel =
    sourceCount === 0
      ? 'not yet rated by critics'
      : `${sourceCount} of ${maxSources} rating source${maxSources !== 1 ? 's' : ''}`

  return (
    <>
      <div
        className={`px-5 py-5 rounded-xl ${className}`}
        style={{
          border: '1px dashed var(--color-border)',
          backgroundColor: 'var(--color-surface-muted)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 inline-flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: '999px',
              backgroundColor: 'rgba(142,59,70,0.08)',
            }}
            aria-hidden="true"
          >
            <Utensils size={18} style={{ color: 'var(--color-action)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold mb-0.5"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
            >
              Not yet rated by diners
            </p>
            <p
              className="text-xs mb-3"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              {sourcesLabel} &middot; your verdict shapes the community score
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: 'var(--color-action)',
                color: 'var(--color-on-action)',
                borderRadius: 'var(--r-input)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.08em',
                minHeight: 44,
              }}
            >
              <Utensils size={13} aria-hidden="true" />
              Be the first fork
            </button>
          </div>
        </div>
      </div>

      <VerdictSheet
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        restaurantCity={restaurantCity}
        topDishes={topDishes}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onVerdictSaved={onVerdictSaved}
      />
    </>
  )
}
