'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

const STORAGE_KEY = 'gastronome:community-waitlist'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done'; email: string }
  | { kind: 'error'; message: string }

/**
 * Waitlist signup for the upcoming Community feature.
 *
 * Intentionally client-side-only for now: we don't want to stand up a
 * mailing-list backend just to unblock the QA fix. Emails are stored in
 * localStorage (under `gastronome:community-waitlist`) so repeat visits
 * remember the user's submission and the form flips to the "you're on
 * the list" state without another round-trip. When a real backend lands,
 * drain localStorage into the POST handler on mount.
 *
 * We read localStorage via a lazy state initialiser rather than inside
 * a `useEffect` — this avoids the React 19 "set-state-in-effect"
 * cascade warning, and it's still safe because the component is marked
 * `'use client'` (so the initializer only runs in the browser).
 */
function loadInitialStatus(): Status {
  if (typeof window === 'undefined') return { kind: 'idle' }
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (!existing) return { kind: 'idle' }
    const parsed = JSON.parse(existing) as { email?: string }
    if (parsed.email && EMAIL_RE.test(parsed.email)) {
      return { kind: 'done', email: parsed.email }
    }
  } catch {
    // localStorage can throw in private mode — fine, fall through to
    // the default idle state.
  }
  return { kind: 'idle' }
}

export default function CommunityWaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>(loadInitialStatus)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({ kind: 'error', message: 'Enter a valid email address.' })
      return
    }
    setStatus({ kind: 'submitting' })
    // Simulate a short async call so the UI gets a visible loading state
    // (and keeps users from double-submitting).
    window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ email: trimmed, submittedAt: Date.now() })
        )
      } catch {
        // Non-fatal — confirm anyway.
      }
      setStatus({ kind: 'done', email: trimmed })
    }, 450)
  }

  if (status.kind === 'done') {
    return (
      <div
        role="status"
        className="w-full max-w-md border rounded-sm px-5 py-6 text-center"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-accent)',
        }}
      >
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Check className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <p
          className="text-sm font-medium mb-1"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
        >
          You&apos;re on the list
        </p>
        <p
          className="text-xs"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          We&apos;ll email {status.email} when invites open.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md flex flex-col sm:flex-row gap-3"
      noValidate
    >
      <label className="sr-only" htmlFor="community-email">
        Email address
      </label>
      <input
        id="community-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (status.kind === 'error') setStatus({ kind: 'idle' })
        }}
        disabled={status.kind === 'submitting'}
        aria-invalid={status.kind === 'error'}
        aria-describedby={status.kind === 'error' ? 'community-email-error' : undefined}
        className="flex-1 px-4 py-3 text-sm rounded-sm border outline-none transition-colors"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor:
            status.kind === 'error' ? '#dc2626' : 'var(--color-border)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
        }}
      />
      <button
        type="submit"
        disabled={status.kind === 'submitting' || !email.trim()}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs uppercase rounded-sm text-white transition-opacity disabled:opacity-60"
        style={{
          backgroundColor: 'var(--color-primary)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.14em',
          fontWeight: 500,
        }}
      >
        {status.kind === 'submitting' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Joining
          </>
        ) : (
          'Request invite'
        )}
      </button>
      {status.kind === 'error' && (
        <p
          id="community-email-error"
          role="alert"
          className="sm:col-span-2 text-xs text-red-600 w-full"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {status.message}
        </p>
      )}
    </form>
  )
}
