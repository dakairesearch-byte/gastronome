'use client'

import { useEffect, useState } from 'react'
import SignInModal from './SignInModal'

const OPEN_EVENT = 'gastronome:open-signin'

interface OpenDetail {
  mode?: 'signin' | 'signup'
  redirectTo?: string
}

/**
 * Imperative opener. Any client component can call `openSignInModal()`
 * without wiring up a React context — it dispatches a window event that
 * the mounted `<SignInModalHost>` listens to.
 *
 * The event-based seam was chosen to match other cross-component stores
 * in this app (`gastronome:favorites`, `gastronome:collections`, …),
 * which keeps one mental model for "fire and the right subscriber
 * handles it."
 */
export function openSignInModal(detail: OpenDetail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }))
}

/**
 * Mount once (in `layout.tsx`). Renders the modal whenever
 * `openSignInModal()` fires, and tears it down on close.
 */
export default function SignInModalHost() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [redirectTo, setRedirectTo] = useState<string>('/')

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<OpenDetail>).detail ?? {}
      setMode(detail.mode ?? 'signin')
      setRedirectTo(detail.redirectTo ?? '/')
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  return (
    <SignInModal
      open={open}
      onClose={() => setOpen(false)}
      initialMode={mode}
      redirectTo={redirectTo}
    />
  )
}
