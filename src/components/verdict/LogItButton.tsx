'use client'

/**
 * LogItButton — "Log it" trigger button for the restaurant detail page.
 *
 * Placed near Bookmark/Share in the hero action row. Unauth tap opens
 * the sign-in modal (same flow as BookmarkButton). Auth tap opens the
 * VerdictSheet.
 */

import { useEffect, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import VerdictSheet from './VerdictSheet'
import type { User } from '@supabase/supabase-js'

interface LogItButtonProps {
  restaurantId: string
  restaurantName: string
  topDishes?: string[]
  /** Trigger a data refresh (e.g. community stats) after a verdict is saved. */
  onVerdictSaved?: () => void
}

export default function LogItButton({
  restaurantId,
  restaurantName,
  topDishes = [],
  onVerdictSaved,
}: LogItButtonProps) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

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
      try { listener?.subscription?.unsubscribe?.() } catch { /* unmount */ }
    }
  }, [])

  const handleClick = () => {
    if (!user) {
      openSignInModal({ mode: 'signin' })
      return
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={user ? `Log your verdict for ${restaurantName}` : 'Sign in to log a verdict'}
        title={user ? 'Log your verdict' : 'Sign in to log a verdict'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-200 border border-white/10 transition-colors"
      >
        <UtensilsCrossed size={14} aria-hidden="true" />
        Log it
      </button>

      <VerdictSheet
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        topDishes={topDishes}
        open={open}
        onClose={() => setOpen(false)}
        onVerdictSaved={onVerdictSaved}
      />
    </>
  )
}
