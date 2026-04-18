'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, MailCheck, AlertCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { City } from '@/types/database'
import OnboardingSteps from './OnboardingSteps'

interface SignInModalProps {
  open: boolean
  onClose: () => void
  initialMode?: 'signin' | 'signup'
  redirectTo?: string
}

type ViewMode = 'signin' | 'signup' | 'forgot'

/**
 * Popup sign-in / sign-up + onboarding dialog.
 *
 * Three view modes live on the `auth` phase:
 *   - `signin`  — email + password, with Google OAuth and "Forgot
 *                 password?" escape hatches.
 *   - `signup`  — creates an account and either transitions into the
 *                 onboarding phase (session available) or parks the
 *                 user on the "check your email" confirmation screen.
 *   - `forgot`  — lightweight password-reset flow that POSTs to
 *                 Supabase and shows a confirmation panel.
 *
 * After a successful signup with an active session the dialog
 * transitions directly into the onboarding steps — no page navigation,
 * no flash. Returning users who sign in skip straight to `redirectTo`.
 *
 * The middleware guard in `src/lib/supabase/middleware.ts` still forces
 * unonboarded users to `/onboarding` on hard navigation, so the
 * standalone page acts as a fallback for the email-confirm flow.
 */
export default function SignInModal({
  open,
  onClose,
  initialMode = 'signin',
  redirectTo = '/',
}: SignInModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  const [phase, setPhase] = useState<'auth' | 'onboarding'>('auth')
  const [mode, setMode] = useState<ViewMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [homeCity, setHomeCity] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!open) return
    setPhase('auth')
    setMode(initialMode)
    setError('')
    setAwaitingConfirmation(false)
    setResetSent(false)
    setLoading(false)
    setOauthLoading(false)
  }, [open, initialMode])

  useEffect(() => {
    if (!open || mode !== 'signup' || cities.length > 0) return
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (active) setCities(data ?? [])
    })()
    return () => {
      active = false
    }
  }, [open, mode, cities.length, supabase])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 20)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  // Map Supabase error codes to user-friendly copy. Covers the common
  // offenders — bad creds, unconfirmed email, rate limiting — that the
  // modal previously surfaced as raw backend prose (bug #21).
  const friendlyError = (message: string): string => {
    const lower = message.toLowerCase()
    if (lower.includes('invalid login credentials')) {
      return 'That email and password combination didn\u2019t match. Double-check your password — or use "Forgot password?" below.'
    }
    if (lower.includes('email not confirmed')) {
      return 'Your email isn\u2019t confirmed yet. Check your inbox for the verification link.'
    }
    if (lower.includes('rate') || lower.includes('too many')) {
      return 'Too many attempts. Please wait a minute before trying again.'
    }
    if (lower.includes('database error')) {
      return 'Unable to sign in right now. Please try again in a moment.'
    }
    if (lower.includes('user already registered')) {
      return 'An account with that email already exists. Try signing in instead.'
    }
    if (lower.includes('weak password')) {
      return 'That password is too weak — try something longer or with more variety.'
    }
    return message
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Email is required')
    if (!password) return setError('Password is required')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(friendlyError(signInError.message))
        return
      }
      onClose()
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) return setError('Display name is required')
    if (username.trim().length < 3) return setError('Username must be at least 3 characters')
    if (!email.trim()) return setError('Email is required')
    if (password.length < 6) return setError('Password must be at least 6 characters')

    setLoading(true)
    try {
      const emailRedirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/onboarding`
          : undefined
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            username,
            display_name: displayName,
            home_city: homeCity || null,
            is_critic: true,
          },
        },
      })
      if (signupError) return setError(friendlyError(signupError.message))
      if (!data.user) return setError('Signup failed — no user returned')

      if (!data.session) {
        setAwaitingConfirmation(true)
        return
      }

      // Session exists → transition straight into the onboarding steps
      // inside this same dialog. No route change, no flash.
      setPhase('onboarding')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Enter your email to receive a reset link')
    setLoading(true)
    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/profile`
          : undefined
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: redirectUrl }
      )
      if (resetError) return setError(friendlyError(resetError.message))
      setResetSent(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setOauthLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
              : undefined,
        },
      })
      if (oauthError) {
        // Most common reason this fails is the provider not being enabled
        // in the Supabase dashboard. Surface a helpful message rather than
        // a raw "provider not found" string.
        const lower = oauthError.message.toLowerCase()
        if (lower.includes('provider') || lower.includes('not enabled')) {
          setError('Google sign-in is not yet enabled. Use email and password for now.')
        } else {
          setError(friendlyError(oauthError.message))
        }
        setOauthLoading(false)
      }
      // On success the browser will redirect, so no additional state update.
    } catch {
      setError('Could not start Google sign-in. Please try again.')
      setOauthLoading(false)
    }
  }

  const handleOnboardingComplete = () => {
    onClose()
    router.push('/')
    router.refresh()
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    // Don't let the user dismiss the modal during onboarding — they
    // need to finish it. The middleware would redirect them back anyway.
    if (phase === 'onboarding') return
    if (e.target === e.currentTarget) onClose()
  }

  // Wider container for the onboarding steps (city grid + previews).
  const maxW = phase === 'onboarding' ? 'max-w-xl' : 'max-w-md'

  const headingTitle = awaitingConfirmation
    ? 'Check your email'
    : mode === 'signin'
    ? 'Welcome back'
    : mode === 'signup'
    ? 'Join Gastronome'
    : 'Reset your password'

  const headingSub = awaitingConfirmation
    ? 'Confirm your email to finish setting up'
    : mode === 'signin'
    ? 'Sign in to save restaurants and write reviews'
    : mode === 'signup'
    ? 'Create an account to save and share favorites'
    : 'We\u2019ll email you a link to set a new password'

  return (
    <div
      onMouseDown={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 animate-[fadeIn_0.18s_ease-out]"
      style={{ backgroundColor: 'rgba(28,28,28,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        ref={dialogRef}
        className={`relative w-full ${maxW} rounded-sm shadow-2xl overflow-hidden transition-all`}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          maxHeight: '90vh',
        }}
      >
        {/* Close button — hidden during onboarding so users finish the flow. */}
        {phase === 'auth' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-sm transition-colors hover:bg-gray-100 z-10"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X size={18} />
          </button>
        )}

        {/* ── Auth phase ── */}
        {phase === 'auth' && (
          <>
            <div
              className="relative px-8 pt-12 pb-6 text-center"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
              }}
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
                    backgroundColor:
                      mode === 'signup' ? 'var(--color-accent)' : 'var(--color-primary)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 500,
                    fontSize: '20px',
                  }}
                >
                  G
                </div>
                {/* Mode pill so users see the state change beyond just the button label (bug #20). */}
                {!awaitingConfirmation && (
                  <p
                    className="text-[10px] uppercase tracking-[0.24em] mb-2"
                    style={{
                      color:
                        mode === 'signup'
                          ? 'var(--color-accent)'
                          : 'var(--color-primary)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                    }}
                  >
                    {mode === 'signin'
                      ? 'Sign in'
                      : mode === 'signup'
                      ? 'New account'
                      : 'Password reset'}
                  </p>
                )}
                <h2
                  id="signin-modal-title"
                  className="text-3xl"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 400,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {headingTitle}
                </h2>
                <p
                  className="mt-2 text-sm"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 300,
                  }}
                >
                  {headingSub}
                </p>
              </div>
            </div>

            <div
              className="px-8 py-7 overflow-y-auto"
              style={{ maxHeight: 'calc(90vh - 220px)' }}
            >
              {awaitingConfirmation ? (
                <div className="text-center">
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-sm mb-4"
                    style={{ backgroundColor: 'var(--color-background)' }}
                  >
                    <MailCheck size={22} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    We sent a confirmation link to{' '}
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{email}</span>.
                    Click the link to activate your account, then come back here to sign in.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 inline-block px-6 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.12em',
                      fontWeight: 500,
                    }}
                  >
                    Got it
                  </button>
                </div>
              ) : mode === 'forgot' && resetSent ? (
                <div className="text-center">
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-sm mb-4"
                    style={{ backgroundColor: 'var(--color-background)' }}
                  >
                    <MailCheck size={22} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    If an account exists for{' '}
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{email}</span>,
                    you&apos;ll get a password-reset email shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setResetSent(false)
                      setError('')
                    }}
                    className="mt-6 inline-flex items-center gap-1.5 px-6 py-2.5 text-xs uppercase rounded-sm border transition-colors hover:bg-gray-50"
                    style={{
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.12em',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <ArrowLeft size={14} />
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

                  {/* OAuth row — hidden on forgot-password since it doesn't apply. */}
                  {mode !== 'forgot' && (
                    <>
                      <button
                        type="button"
                        onClick={handleGoogle}
                        disabled={oauthLoading || loading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-sm border transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {oauthLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <GoogleIcon />
                        )}
                        <span className="text-sm font-medium">
                          Continue with Google
                        </span>
                      </button>
                      <div className="flex items-center gap-3 my-5">
                        <span
                          className="flex-1 h-px"
                          style={{ backgroundColor: 'var(--color-border)' }}
                        />
                        <span
                          className="text-[10px] uppercase"
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-body)',
                            letterSpacing: '0.2em',
                          }}
                        >
                          or
                        </span>
                        <span
                          className="flex-1 h-px"
                          style={{ backgroundColor: 'var(--color-border)' }}
                        />
                      </div>
                    </>
                  )}

                  <form
                    onSubmit={
                      mode === 'signin'
                        ? handleSignIn
                        : mode === 'signup'
                        ? handleSignUp
                        : handleForgot
                    }
                    className="space-y-4"
                    noValidate
                  >
                    {mode === 'signup' && (
                      <>
                        <Field label="Display Name">
                          <input
                            ref={firstFieldRef}
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            placeholder="Your Name"
                            style={inputStyle}
                            className="w-full px-4 py-2.5 outline-none transition-colors"
                          />
                        </Field>
                        <Field label="Username">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) =>
                              setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))
                            }
                            required
                            placeholder="your_username"
                            style={inputStyle}
                            className="w-full px-4 py-2.5 outline-none transition-colors"
                          />
                        </Field>
                      </>
                    )}
                    <Field label="Email">
                      <input
                        ref={mode !== 'signup' ? firstFieldRef : undefined}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        style={inputStyle}
                        className="w-full px-4 py-2.5 outline-none transition-colors"
                      />
                    </Field>
                    {mode !== 'forgot' && (
                      <Field
                        label={
                          <span className="flex items-center justify-between w-full">
                            <span>Password</span>
                            {mode === 'signin' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMode('forgot')
                                  setError('')
                                  setPassword('')
                                }}
                                className="text-[11px] normal-case tracking-normal transition-opacity hover:opacity-80"
                                style={{
                                  color: 'var(--color-primary)',
                                  fontWeight: 500,
                                  letterSpacing: '0',
                                }}
                              >
                                Forgot password?
                              </button>
                            )}
                          </span>
                        }
                      >
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={mode === 'signup' ? 6 : undefined}
                          placeholder={
                            mode === 'signup' ? 'Create a password (6+ characters)' : 'Your password'
                          }
                          autoComplete={
                            mode === 'signup' ? 'new-password' : 'current-password'
                          }
                          style={inputStyle}
                          className="w-full px-4 py-2.5 outline-none transition-colors"
                        />
                      </Field>
                    )}

                    {mode === 'signup' && (
                      <Field
                        label={
                          <>
                            Home City{' '}
                            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>
                              (optional)
                            </span>
                          </>
                        }
                      >
                        <select
                          value={homeCity}
                          onChange={(e) => setHomeCity(e.target.value)}
                          style={inputStyle}
                          className="w-full px-4 py-2.5 outline-none transition-colors"
                        >
                          <option value="">Select a city</option>
                          {cities.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                              {c.state ? `, ${c.state}` : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    <button
                      type="submit"
                      disabled={loading || oauthLoading}
                      className="w-full py-3 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        fontFamily: 'var(--font-body)',
                        letterSpacing: '0.16em',
                        fontWeight: 500,
                      }}
                    >
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      {loading
                        ? mode === 'signin'
                          ? 'Signing in\u2026'
                          : mode === 'signup'
                          ? 'Creating\u2026'
                          : 'Sending\u2026'
                        : mode === 'signin'
                        ? 'Sign in'
                        : mode === 'signup'
                        ? 'Create account'
                        : 'Send reset link'}
                    </button>
                  </form>

                  {mode === 'forgot' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin')
                        setError('')
                      }}
                      className="w-full text-center text-sm mt-6 inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <ArrowLeft size={13} />
                      Back to sign in
                    </button>
                  ) : (
                    <p
                      className="text-center text-sm mt-6"
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {mode === 'signin' ? (
                        <>
                          Don&rsquo;t have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('signup')
                              setError('')
                            }}
                            style={{ color: 'var(--color-primary)', fontWeight: 500 }}
                            className="hover:opacity-80 transition-opacity"
                          >
                            Create one
                          </button>
                        </>
                      ) : (
                        <>
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setMode('signin')
                              setError('')
                            }}
                            style={{ color: 'var(--color-primary)', fontWeight: 500 }}
                            className="hover:opacity-80 transition-opacity"
                          >
                            Sign in
                          </button>
                        </>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── Onboarding phase ── */}
        {phase === 'onboarding' && (
          <div className="px-8 py-8 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <OnboardingSteps onComplete={handleOnboardingComplete} />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: '2px',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
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
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Inline Google "G" mark. We avoid an img/SVG asset dependency so the
 * button renders instantly even on cold edge caches.
 */
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M21.35 11.1h-9.17v2.96h5.3c-.23 1.48-1.65 4.34-5.3 4.34-3.19 0-5.8-2.65-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.04.77 3.74 1.44l2.54-2.46C16.92 3.98 14.76 3 12.18 3 6.98 3 2.75 7.23 2.75 12.5S6.98 22 12.18 22c7.03 0 9.35-4.93 9.35-7.43 0-.5-.06-.88-.18-1.47Z"
        fill="#4285F4"
      />
    </svg>
  )
}
