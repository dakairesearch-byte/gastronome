'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import { useAuthUser } from '@/lib/hooks/useAuthUser'

interface BeenButtonProps {
  restaurantId: string
  /** Whether this restaurant is already in the user's Been list */
  initialTried: boolean
  /** Called with new tried-state after a successful RPC */
  onToggle?: (tried: boolean) => void
}

/**
 * Tap-to-log Been verdict on a checklist row.
 *
 * Uses submit_verdict RPC (partial call = been only, no rating/would_return).
 * Anonymous users are gated to sign-in. No loss-framing — button is purely
 * additive ("Mark as tried"); we do not penalize un-checking.
 *
 * Note: submit_verdict is append/merge, not a toggle — once logged a Been
 * cannot be removed via this UI (which is correct: you can't un-visit a
 * restaurant). The button becomes a static check after first tap.
 */
export default function BeenButton({
  restaurantId,
  initialTried,
  onToggle,
}: BeenButtonProps) {
  const user = useAuthUser()
  const [tried, setTried] = useState(initialTried)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (!user) {
      openSignInModal({ mode: 'signin' })
      return
    }

    if (tried) return // already logged — nothing to do

    startTransition(async () => {
      setError(null)
      const supabase = createClient()
      // Been = partial call; optional params omitted (SQL defaults apply).
      const { error: rpcError } = await supabase.rpc('submit_verdict', {
        p_restaurant_id: restaurantId,
      })
      if (rpcError) {
        setError('Could not log visit. Try again.')
        return
      }
      setTried(true)
      onToggle?.(true)
    })
  }

  if (tried) {
    return (
      <div
        className="inline-flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-action) 12%, transparent)' }}
        role="img"
        aria-label="Been here"
        title="Been here"
      >
        <Check
          size={18}
          strokeWidth={2.5}
          style={{ color: 'var(--color-action)' }}
          aria-hidden="true"
        />
      </div>
    )
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={user ? 'Mark as tried' : 'Sign in to track'}
        title={user ? 'Mark as tried' : 'Sign in to track'}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full border transition-colors hover:border-[var(--color-action)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <Check
          size={18}
          strokeWidth={1.5}
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden="true"
        />
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full mt-1 text-xs whitespace-nowrap rounded px-2 py-1 shadow-md"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: '#dc2626',
            border: '1px solid var(--color-border)',
            zIndex: 10,
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
