'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Set-new-password screen for the password-reset flow.
 *
 * The reset email's link points at `/auth/callback?next=/auth/reset-password`,
 * which exchanges the recovery code for a session before redirecting here.
 * Supabase-js also fires a `PASSWORD_RECOVERY` auth event when it detects a
 * recovery link, so we listen for both: an existing session (via the
 * callback exchange) OR the recovery event. Either way, once a recovery
 * session is present the user can set a new password with
 * `supabase.auth.updateUser({ password })`.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [sessionMissing, setSessionMissing] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true

    // Listen for the recovery event Supabase emits when a reset link is
    // opened in a fresh tab without the callback exchange.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setSessionMissing(false)
      }
    })

    // The callback route normally establishes the session before landing
    // here. Probe for it so a directly-loaded page still works.
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return
      if (session) {
        setReady(true)
      } else {
        // Give the recovery event a brief window to arrive before declaring
        // the link invalid/expired.
        setTimeout(() => {
          if (active && !ready) setSessionMissing(true)
        }, 1500)
      }
    })()

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirmPassword) return setError('Passwords don’t match')

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        const lower = updateError.message.toLowerCase()
        if (lower.includes('same') || lower.includes('different from the old')) {
          setError('That’s your current password — choose a new one.')
        } else if (lower.includes('session') || lower.includes('expired')) {
          setError('Your reset link has expired. Request a new one from the sign-in screen.')
        } else {
          setError(updateError.message)
        }
        setLoading(false)
        return
      }
      setDone(true)
      // Brief confirmation, then send them to the home page (now signed in).
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 1600)
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div
        className="relative w-full max-w-md rounded-sm shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="relative px-8 pt-12 pb-6 text-center"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.14] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, var(--color-accent) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="relative">
            <div
              className="w-12 h-12 mx-auto rounded-sm flex items-center justify-center text-white shadow-sm mb-4"
              style={{
                backgroundColor: 'var(--color-primary)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 500,
                fontSize: '20px',
              }}
              aria-hidden="true"
            >
              G
            </div>
            <h1
              className="text-3xl"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 400,
                letterSpacing: '-0.01em',
              }}
            >
              Set a new password
            </h1>
            <p
              className="mt-2 text-sm"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 300,
              }}
            >
              Choose a new password for your account
            </p>
          </div>
        </div>

        <div className="px-8 py-7">
          {done ? (
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-sm mb-4"
                style={{ backgroundColor: 'var(--color-background)' }}
              >
                <CheckCircle2 size={22} style={{ color: 'var(--color-primary)' }} />
              </div>
              <p
                className="text-sm"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Your password has been updated. Taking you to the app…
              </p>
            </div>
          ) : sessionMissing ? (
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-sm mb-4"
                style={{ backgroundColor: '#fdf2f2' }}
              >
                <AlertCircle size={22} style={{ color: '#9c2a2a' }} />
              </div>
              <p
                className="text-sm"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                This reset link is invalid or has expired. Head back to sign in
                and request a fresh one.
              </p>
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="mt-6 inline-block px-6 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.12em',
                  fontWeight: 500,
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-4 p-3 text-sm rounded-sm border flex items-start gap-2"
                  style={{
                    backgroundColor: '#fdf2f2',
                    borderColor: '#f5c2c2',
                    color: '#9c2a2a',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <label className="block">
                  <span
                    className="block text-xs uppercase mb-1.5"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      fontWeight: 500,
                    }}
                  >
                    New password
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={!ready}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      style={inputStyle}
                      className="w-full px-4 py-2.5 outline-none transition-colors pr-12 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span
                    className="block text-xs uppercase mb-1.5"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.1em',
                      fontWeight: 500,
                    }}
                  >
                    Confirm password
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={!ready}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    style={inputStyle}
                    className="w-full px-4 py-2.5 outline-none transition-colors disabled:opacity-50"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading || !ready}
                  className="w-full py-3 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.16em',
                    fontWeight: 500,
                  }}
                >
                  {(loading || !ready) && <Loader2 size={14} className="animate-spin" />}
                  {!ready ? 'Verifying link…' : loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: '2px',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontSize: '16px',
}
