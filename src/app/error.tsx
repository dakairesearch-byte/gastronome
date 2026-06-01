'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    // Report to Sentry if configured. Defensive: no-op when the DSN is
    // unset or @sentry/nextjs isn't installed, and never throws.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      const moduleName = '@sentry/nextjs'
      import(/* webpackIgnore: true */ moduleName)
        .then((Sentry) => Sentry.captureException(error))
        .catch(() => {})
    }
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
