'use client'

import { useEffect } from 'react'

/**
 * Global error boundary (Next 16). Catches errors thrown in the root layout
 * itself — when this renders, the root layout is gone, so it must provide its
 * own <html>/<body>. Keep the markup minimal and self-contained (no shared
 * providers or fonts are guaranteed to be available here).
 *
 * Reports to Sentry when configured; the capture is defensive and never
 * throws when the DSN is unset or @sentry/nextjs isn't installed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      const moduleName = '@sentry/nextjs'
      import(/* webpackIgnore: true */ moduleName)
        .then((Sentry) => Sentry.captureException(error))
        .catch(() => {})
    }
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily:
            'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
          background: 'var(--color-background, #ffffff)',
          color: 'var(--color-foreground, #111827)',
        }}
      >
        <div
          style={{
            maxWidth: '24rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-muted-foreground, #6b7280)',
              margin: 0,
            }}
          >
            An unexpected error occurred. Please try again.
          </p>
          <div>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'var(--color-primary, #10b981)',
                color: 'var(--color-primary-foreground, #ffffff)',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
