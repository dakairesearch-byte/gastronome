'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'

// Mirror of the server validation (src/app/api/waitlist/route.ts). Kept
// permissive on purpose — just enough to catch the obvious typos before a
// round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = 'idle' | 'loading' | 'success' | 'error'

function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return

    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setStatus('error')
      setErrorMsg('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        setStatus('error')
        setErrorMsg(data?.error ?? 'Something went wrong. Please try again.')
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMsg('Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <p
        role="status"
        className="text-base md:text-lg leading-relaxed"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
          lineHeight: 1.7,
        }}
      >
        You&rsquo;re on the list &mdash; we&rsquo;ll email you when we launch.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-md flex flex-col gap-3"
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') {
              setStatus('idle')
              setErrorMsg(null)
            }
          }}
          disabled={status === 'loading'}
          className="flex-1 px-4 py-3 rounded-sm border outline-none transition-colors"
          style={{
            // 16px minimum prevents iOS Safari zoom-on-focus.
            fontSize: '16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            color: 'var(--color-text)',
            backgroundColor: 'var(--color-surface)',
            borderColor:
              status === 'error'
                ? 'var(--color-accent)'
                : 'var(--color-border)',
          }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-6 py-3 rounded-sm uppercase transition-opacity disabled:opacity-60"
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.14em',
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            color: 'var(--color-background)',
            backgroundColor: 'var(--color-accent)',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? 'Joining…' : 'Notify me when it launches'}
        </button>
      </div>

      {status === 'error' && errorMsg && (
        <p
          role="alert"
          className="text-sm text-left"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
          }}
        >
          {errorMsg}
        </p>
      )}
    </form>
  )
}

export default function CommunityPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-28">
        <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
          <div
            className="inline-flex items-center justify-center w-28 h-28 md:w-32 md:h-32 mb-8 md:mb-10 border rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-accent)',
            }}
          >
            <Users
              className="w-14 h-14 md:w-16 md:h-16"
              style={{ color: 'var(--color-accent)' }}
              strokeWidth={1.25}
            />
          </div>

          <div className="mb-3">
            <span
              className="text-xs uppercase"
              style={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.18em',
                fontWeight: 500,
              }}
            >
              Members Only
            </span>
          </div>

          <h1
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              fontSize: '2.25rem',
              marginBottom: '24px',
            }}
          >
            Coming Soon
          </h1>

          <div
            className="w-12 h-px mb-8"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />

          <p
            className="text-base md:text-lg leading-relaxed mb-10"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}
          >
            An exclusive community for discerning food enthusiasts. Connect,
            share, and discover exceptional dining experiences. Leave your
            email and we&rsquo;ll let you know the moment it opens.
          </p>

          <WaitlistForm />
        </div>
      </div>
    </div>
  )
}
