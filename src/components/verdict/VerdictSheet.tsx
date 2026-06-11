'use client'

/**
 * VerdictSheet — The Verdict Stack bottom-sheet (mobile) / modal (desktop).
 *
 * Architecture:
 *  Tier 1 — "Been here" one-tap (submit_verdict with only p_restaurant_id)
 *  Tier 2 — "Would you go back?" yes / no / skip
 *  Tier 3 — OPTIONAL anchored 1-10 picker (10 visible but disabled)
 *  Tier 4 — OPTIONAL dish chips from restaurant_top_dishes + free-text add
 *  Done state.
 *
 * Every tier calls submit_verdict immediately via partial-merge RPC, so
 * closing early loses nothing. Unauth tap opens the sign-in modal.
 *
 * Body-scroll locked while open. Focus trapped inside.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Check, ChevronRight, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import { recordPositiveEvent } from '@/lib/taste'

export interface VerdictSheetProps {
  restaurantId: string
  restaurantName: string
  /** Top-dish display names from restaurant_top_dishes. Pass [] when none. */
  topDishes?: string[]
  open: boolean
  onClose: () => void
  /** Optional callback after any successful RPC call. */
  onVerdictSaved?: () => void
  /** Restaurant metadata forwarded to the taste vector on positive signals. */
  tasteHint?: { cuisine: string | null; city: string | null; price_range: number | null; michelin_stars: number | null }
}

type Tier = 'been' | 'return' | 'rating' | 'dishes' | 'done'

const RATING_ANCHORS: Record<number, string> = {
  5: 'perfectly fine',
  7: 'great',
  8: 'excellent',
  9: 'all-timer',
}

function FocusTrap({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea, a[href]'
    )
    if (focusable.length > 0) focusable[0].focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const items = Array.from(
        el!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea, a[href]'
        )
      ).filter((n) => !n.closest('[aria-hidden="true"]'))
      if (items.length === 0) return
      // Recapture: tier swaps unmount the focused button and drop focus to
      // <body>; without this, the next Tab would escape the dialog.
      const activeEl = document.activeElement as HTMLElement | null
      if (!activeEl || !el!.contains(activeEl)) {
        e.preventDefault()
        items[0].focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return <div ref={ref}>{children}</div>
}

export default function VerdictSheet({
  restaurantId,
  restaurantName,
  topDishes = [],
  open,
  onClose,
  onVerdictSaved,
  tasteHint,
}: VerdictSheetProps) {
  const [tier, setTier] = useState<Tier>('been')
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [selectedDishes, setSelectedDishes] = useState<Set<string>>(new Set())
  const [customDish, setCustomDish] = useState('')
  const [customDishes, setCustomDishes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset state when the sheet (re)opens. Uses the React-sanctioned
  // "adjust state during render" pattern instead of an effect, which
  // avoids a wasted closed-state render and satisfies
  // react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setTier('been')
      setSelectedRating(null)
      setSelectedDishes(new Set())
      setCustomDish('')
      setCustomDishes([])
      setErrorMsg(null)
    }
  }

  // Body scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape closes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const rpc = useCallback(
    async (params: {
      p_rating?: number | null
      p_would_return?: boolean | null
      p_dish_tags?: string[] | null
    }) => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        openSignInModal({ mode: 'signin' })
        return false
      }
      const { error } = await supabase.rpc('submit_verdict', {
        p_restaurant_id: restaurantId,
        p_ip: null,
        p_ua: null,
        ...params,
      })
      if (error) {
        setErrorMsg('Something went wrong. Your verdict may not have saved.')
        return false
      }
      onVerdictSaved?.()
      return true
    },
    [restaurantId, onVerdictSaved]
  )

  // Tier 1: Been — fire RPC with just restaurant_id, then advance
  const handleBeen = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      openSignInModal({ mode: 'signin' })
      return
    }
    setSubmitting(true)
    setErrorMsg(null)
    const { error } = await supabase.rpc('submit_verdict', {
      p_restaurant_id: restaurantId,
      p_ip: null,
      p_ua: null,
    })
    setSubmitting(false)
    if (error) {
      setErrorMsg('Could not save. Please try again.')
      return
    }
    onVerdictSaved?.()
    setTier('return')
  }, [restaurantId, onVerdictSaved])

  // Tier 2: Would return
  const handleReturn = useCallback(
    async (value: boolean | null) => {
      setSubmitting(true)
      setErrorMsg(null)
      if (value !== null) {
        await rpc({ p_would_return: value })
        if (value === true && tasteHint) recordPositiveEvent(tasteHint)
      }
      setSubmitting(false)
      setTier('rating')
    },
    [rpc, tasteHint]
  )

  // Tier 3: Rating
  const handleRating = useCallback(
    async (rating: number | null) => {
      setSubmitting(true)
      setErrorMsg(null)
      if (rating !== null) {
        setSelectedRating(rating)
        await rpc({ p_rating: rating })
        if (rating >= 7 && tasteHint) recordPositiveEvent(tasteHint)
      }
      setSubmitting(false)
      setTier('dishes')
    },
    [rpc, tasteHint]
  )

  // Tier 4: Dish tags
  const addCustomDish = () => {
    const trimmed = customDish.trim()
    if (!trimmed || customDishes.includes(trimmed)) return
    setCustomDishes((prev) => [...prev, trimmed])
    setCustomDish('')
  }

  const toggleDish = (dish: string) => {
    setSelectedDishes((prev) => {
      const next = new Set(prev)
      if (next.has(dish)) next.delete(dish)
      else next.add(dish)
      return next
    })
  }

  const handleDishDone = useCallback(async () => {
    setSubmitting(true)
    setErrorMsg(null)
    const tags = Array.from(selectedDishes)
    if (tags.length > 0) {
      await rpc({ p_dish_tags: tags })
    }
    setSubmitting(false)
    setTier('done')
  }, [rpc, selectedDishes])

  if (!open) return null

  const allDishOptions = [...topDishes, ...customDishes]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Log your verdict for ${restaurantName}`}
        className={[
          'fixed z-50',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0',
          // Desktop: centered modal
          'sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:max-w-md sm:w-full sm:rounded-xl',
          'rounded-t-2xl',
          'overflow-hidden',
        ].join(' ')}
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 -4px 32px rgba(60,40,30,0.14)',
        }}
      >
        <FocusTrap>
          {/* Handle bar (mobile) */}
          <div
            className="sm:hidden mx-auto mt-3 mb-1 w-10 h-1 rounded-full"
            style={{ backgroundColor: 'var(--color-border)' }}
            aria-hidden="true"
          />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div>
              <p
                className="text-[11px] uppercase tracking-widest"
                style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}
              >
                Your verdict
              </p>
              <h2
                className="text-base mt-0.5"
                style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--color-text)' }}
              >
                {restaurantName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center rounded-full transition-colors"
              style={{
                width: 44,
                height: 44,
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-6 pt-4">
            {errorMsg && (
              <p
                className="mb-3 text-sm px-3 py-2 rounded-md"
                style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#b91c1c', fontFamily: 'var(--font-body)' }}
                role="alert"
              >
                {errorMsg}
              </p>
            )}

            {/* Tier 1: Been */}
            {tier === 'been' && (
              <div className="text-center py-4">
                <p
                  className="text-lg mb-6"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)', fontWeight: 500 }}
                >
                  Have you been here?
                </p>
                <button
                  type="button"
                  onClick={handleBeen}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-action)',
                    color: 'var(--color-on-action)',
                    borderRadius: 'var(--r-input)',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.08em',
                    minWidth: 160,
                    minHeight: 44,
                  }}
                >
                  <Check size={16} aria-hidden="true" />
                  {submitting ? 'Saving…' : "Yes, I've been"}
                </button>
              </div>
            )}

            {/* Tier 2: Would return */}
            {tier === 'return' && (
              <div className="py-2">
                <p
                  className="text-lg mb-1"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)', fontWeight: 500 }}
                >
                  Would you go back?
                </p>
                <p
                  className="text-sm mb-6"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Optional — skip anytime.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleReturn(true)}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-action)',
                      color: 'var(--color-on-action)',
                      borderRadius: 'var(--r-input)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      minHeight: 44,
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReturn(false)}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      borderRadius: 'var(--r-input)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      minHeight: 44,
                    }}
                  >
                    No
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleReturn(null)}
                  disabled={submitting}
                  className="mt-3 w-full text-sm py-2 transition-colors"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Skip this
                </button>
              </div>
            )}

            {/* Tier 3: Rating picker */}
            {tier === 'rating' && (
              <div className="py-2">
                <p
                  className="text-lg mb-1"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)', fontWeight: 500 }}
                >
                  Rate it 1–10
                </p>
                <p
                  className="text-sm mb-5"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Optional — skip anytime.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const isTen = n === 10
                    const anchor = RATING_ANCHORS[n]
                    const isSelected = selectedRating === n
                    return (
                      <div key={n} className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => !isTen && handleRating(n)}
                          disabled={submitting || isTen}
                          aria-pressed={isSelected}
                          aria-label={
                            isTen
                              ? 'A 10 doesn\'t exist yet'
                              : anchor
                              ? `${n} — ${anchor}`
                              : String(n)
                          }
                          title={isTen ? "A 10 doesn't exist yet" : anchor}
                          className="inline-flex items-center justify-center text-base font-semibold transition-colors"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '10px',
                            border: isSelected
                              ? '2px solid var(--color-action)'
                              : '1px solid var(--color-border)',
                            backgroundColor: isSelected
                              ? 'var(--color-action)'
                              : isTen
                              ? 'rgba(0,0,0,0.04)'
                              : 'var(--color-surface)',
                            color: isSelected
                              ? 'var(--color-on-action)'
                              : isTen
                              ? 'var(--color-border)'
                              : 'var(--color-text)',
                            cursor: isTen ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-heading)',
                            opacity: isTen ? 0.45 : 1,
                          }}
                        >
                          {n}
                        </button>
                        {anchor && (
                          <span
                            className="text-[9px] text-center leading-tight"
                            style={{
                              color: isSelected ? 'var(--color-action)' : 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-body)',
                              maxWidth: 44,
                            }}
                          >
                            {anchor}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* 10 tooltip */}
                <p
                  className="mt-3 text-xs italic"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  A 10 doesn&rsquo;t exist yet.
                </p>
                <button
                  type="button"
                  onClick={() => handleRating(null)}
                  disabled={submitting}
                  className="mt-4 w-full text-sm py-2 transition-colors"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Skip rating
                </button>
              </div>
            )}

            {/* Tier 4: Dish chips */}
            {tier === 'dishes' && (
              <div className="py-2">
                <p
                  className="text-lg mb-1"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)', fontWeight: 500 }}
                >
                  What did you have?
                </p>
                <p
                  className="text-sm mb-4"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Optional — tap any dishes you tried.
                </p>

                {allDishOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {allDishOptions.map((dish) => {
                      const active = selectedDishes.has(dish)
                      return (
                        <button
                          key={dish}
                          type="button"
                          onClick={() => toggleDish(dish)}
                          aria-pressed={active}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                          style={{
                            borderRadius: 'var(--r-tag)',
                            border: active
                              ? '1.5px solid var(--color-action)'
                              : '1px solid var(--color-border)',
                            backgroundColor: active
                              ? 'rgba(142,59,70,0.08)'
                              : 'var(--color-surface)',
                            color: active ? 'var(--color-action)' : 'var(--color-text)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: active ? 600 : 400,
                            minHeight: 36,
                          }}
                        >
                          {active && <Check size={12} aria-hidden="true" />}
                          {dish}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Free-text add */}
                <div className="flex items-center gap-2 mb-5">
                  <input
                    type="text"
                    value={customDish}
                    onChange={(e) => setCustomDish(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomDish()
                      }
                    }}
                    placeholder="Add a dish…"
                    maxLength={80}
                    className="flex-1 px-3 py-2 text-sm outline-none"
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--r-input)',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text)',
                      backgroundColor: 'var(--color-surface)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={addCustomDish}
                    disabled={!customDish.trim()}
                    aria-label="Add dish"
                    className="inline-flex items-center justify-center transition-colors disabled:opacity-40"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--r-input)',
                      backgroundColor: 'var(--color-action)',
                      color: 'var(--color-on-action)',
                    }}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDishDone}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-action)',
                    color: 'var(--color-on-action)',
                    borderRadius: 'var(--r-input)',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.08em',
                    minHeight: 44,
                  }}
                >
                  {submitting ? 'Saving…' : 'Done'}
                  {!submitting && <ChevronRight size={16} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTier('done')}
                  disabled={submitting}
                  className="mt-2 w-full text-sm py-2 transition-colors"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Skip dishes
                </button>
              </div>
            )}

            {/* Done state */}
            {tier === 'done' && (
              <div className="text-center py-6">
                <div
                  className="inline-flex items-center justify-center mb-4"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '999px',
                    backgroundColor: 'rgba(142,59,70,0.10)',
                  }}
                >
                  <Check size={28} style={{ color: 'var(--color-action)' }} aria-hidden="true" />
                </div>
                <p
                  className="text-xl mb-1"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)', fontWeight: 600 }}
                >
                  Verdict logged
                </p>
                <p
                  className="text-sm mb-6"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  Thanks for adding your perspective.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold transition-colors"
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--r-input)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                    minHeight: 44,
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </FocusTrap>
      </div>
    </>
  )
}
