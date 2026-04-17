'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { City } from '@/types/database'

interface SignInModalProps {
  open: boolean
  onClose: () => void
  initialMode?: 'signin' | 'signup'
  /**
   * Where to send the user after a successful sign-in. Defaults to the
   * home page. Signup always routes through the confirm-email screen /
   * onboarding flow regardless.
   */
  redirectTo?: string
}

/**
 * Popup sign-in / sign-up dialog.
 *
 * Centered card on a dimmed backdrop, editorial palette (Spectral
 * heading + primary gold CTA). Toggles between Sign in and Create
 * account inline so the user never loses context. Signup triggers
 * Supabase email confirmation and shows a "check your email" success
 * screen; the confirm link routes through `/auth/callback` into
 * `/onboarding`.
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

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [homeCity, setHomeCity] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  // Reset state whenever the dialog opens so a re-open never shows stale
  // errors or a stranded "check your email" screen.
  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setError('')
    setAwaitingConfirmation(false)
    setLoading(false)
  }, [open, initialMode])

  // Lazy-load cities only when switching into the signup form — skips a
  // request for users who only ever hit Sign in.
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

  // Autofocus + Escape-to-close + scroll lock while the dialog is open.
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        if (signInError.message.toLowerCase().includes('database error')) {
          setError('Unable to sign in right now. Please try again in a moment.')
        } else if (signInError.message === 'Invalid login credentials') {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(signInError.message)
        }
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
      if (signupError) return setError(signupError.message)
      if (!data.user) return setError('Signup failed — no user returned')

      // Email confirmation on → stay in the dialog and render the
      // "check your email" state. Confirmation off (dev) → route to
      // onboarding as normal.
      if (!data.session) {
        setAwaitingConfirmation(true)
        return
      }
      onClose()
      router.push('/onboarding')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

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
        className="relative w-full max-w-md rounded-sm shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-sm transition-colors hover:bg-gray-100 z-10"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <X size={18} />
        </button>

        {/* Dot-pattern header mirrors the HomeHero brand aesthetic. */}
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
                backgroundColor: 'var(--color-primary)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 500,
                fontSize: '20px',
              }}
            >
              G
            </div>
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
              {awaitingConfirmation
                ? 'Check your email'
                : mode === 'signin'
                ? 'Welcome back'
                : 'Join Gastronome'}
            </h2>
            <p
              className="mt-2 text-sm"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 300,
              }}
            >
              {awaitingConfirmation
                ? 'Confirm your email to finish setting up'
                : mode === 'signin'
                ? 'Sign in to save restaurants and write reviews'
                : 'Create an account to save and share favorites'}
            </p>
          </div>
        </div>

        <div className="px-8 py-7">
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
          ) : (
            <>
              {error && (
                <div
                  className="mb-4 p-3 text-sm rounded-sm border"
                  style={{
                    backgroundColor: '#fdf2f2',
                    borderColor: '#f5c2c2',
                    color: '#9c2a2a',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
                className="space-y-4"
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
                    ref={mode === 'signin' ? firstFieldRef : undefined}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    style={inputStyle}
                    className="w-full px-4 py-2.5 outline-none transition-colors"
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'signup' ? 6 : undefined}
                    placeholder={mode === 'signup' ? 'Create a password' : 'Your password'}
                    style={inputStyle}
                    className="w-full px-4 py-2.5 outline-none transition-colors"
                  />
                </Field>

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
                  disabled={loading}
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
                      ? 'Signing in…'
                      : 'Creating…'
                    : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
                </button>
              </form>

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
            </>
          )}
        </div>
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
