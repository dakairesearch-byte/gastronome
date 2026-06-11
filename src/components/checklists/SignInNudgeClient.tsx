'use client'

import { openSignInModal } from '@/components/auth/SignInModalHost'

interface SignInNudgeClientProps {
  listTitle: string
}

/**
 * Client island — renders the sign-in call-to-action for anonymous visitors
 * on the checklist detail page. Kept tiny so the server component can stay
 * a server component while still having an interactive element.
 */
export default function SignInNudgeClient({ listTitle }: SignInNudgeClientProps) {
  return (
    <div
      className="mt-8 p-4 rounded-[var(--r-card)] text-center"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p
        className="text-sm"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
      >
        Sign in to track which places on the{' '}
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{listTitle}</span>{' '}
        you&apos;ve tried.
      </p>
      <button
        type="button"
        onClick={() => openSignInModal({ mode: 'signin' })}
        className="mt-3 inline-flex items-center px-5 py-2.5 rounded-sm text-xs uppercase tracking-wider font-medium transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.1em',
          backgroundColor: 'var(--color-action)',
          color: 'var(--color-on-action)',
        }}
      >
        Sign in
      </button>
    </div>
  )
}
