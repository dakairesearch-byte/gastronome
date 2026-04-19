'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Search,
  Layers,
  Star,
  MapPin,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { City } from '@/types/database'
import type { User } from '@supabase/supabase-js'

/**
 * Gastronome's default landing experience.
 *
 * Four panes, surfaced to EVERY visitor without an account:
 *   1. Problem    — food ratings are scattered across Google, Yelp,
 *                   Michelin, The Infatuation, TikTok, Instagram.
 *   2. Solution   — Gastronome unifies them and layers in critic +
 *                   social signal so you can decide at a glance.
 *   3. City       — pick the one city you want to explore. Single
 *                   selection (previously up to 3, simplified so the
 *                   homepage has a canonical city context).
 *   4. Sign-up    — inline account creation. No escape. Anonymous
 *                   browsing has been removed per product direction:
 *                   the whole value prop is preferences + saved
 *                   collections, which require an account.
 *
 * Authed-but-unfinished users skip straight to pane 3, finalize the
 * city, and land on the "ready to explore" confirmation instead of a
 * sign-up form (pane 4 branches on session state).
 */

type StepKey = 'problem' | 'solution' | 'city' | 'account'
const STEPS: StepKey[] = ['problem', 'solution', 'city', 'account']

export default function OnboardingFlow() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [stepIndex, setStepIndex] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [cities, setCities] = useState<City[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('')

  // Sign-up form state (pane 4, anon users)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const step = STEPS[stepIndex]

  // One-time auth probe — determines whether pane 4 is a sign-up form
  // or a "you're all set" confirmation.
  useEffect(() => {
    let active = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return
      setUser(session?.user ?? null)
      setAuthChecked(true)
    })()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('restaurant_count', { ascending: false })
      if (active) setCities(data ?? [])
    })()
    return () => {
      active = false
    }
  }, [supabase])

  const canProceed = (() => {
    if (step === 'problem' || step === 'solution') return true
    if (step === 'city') return !!selectedCity
    return true
  })()

  const goNext = () => {
    if (!canProceed) return
    setError(null)
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  const goBack = () => {
    setError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  // Auto-derive a username from display name when the user hasn't
  // customized it — tiny ergonomic win that avoids the classic
  // "why do I need two different name fields?" friction.
  const displayNameRef = useRef(displayName)
  displayNameRef.current = displayName
  useEffect(() => {
    if (!displayName) return
    const auto = slugifyUsername(displayName)
    // Only overwrite username if it's empty or was previously auto-set.
    setUsername((prev) => {
      const prevAuto = slugifyUsername(displayNameRef.current)
      if (!prev || prev === prevAuto) return auto
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName])

  /**
   * Save preferences for an already-authed user and send them home.
   * Called by pane 4's "Start exploring" button when we have a session.
   */
  const finishForAuthedUser = async () => {
    if (!user) return
    setError(null)
    setSubmitting(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          home_city: selectedCity || null,
          favorite_cities: selectedCity ? [selectedCity] : [],
        })
        .eq('id', user.id)
      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  /**
   * Create the account, then (if a session comes back immediately)
   * persist the chosen city so the user lands on a pre-configured
   * homepage. If email-confirmation is required, park on a "check
   * your email" state — the trigger-side profile row will already
   * carry the city via `home_city` in user metadata.
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const dn = displayName.trim()
    const un = username.trim().toLowerCase()
    const em = email.trim()

    if (dn.length < 2) return setError('Display name must be at least 2 characters')
    if (un.length < 3) return setError('Username must be at least 3 characters')
    if (!/^[a-z0-9_]+$/.test(un))
      return setError('Username can only contain lowercase letters, numbers, and underscores')
    if (!em) return setError('Email is required')
    if (password.length < 6) return setError('Password must be at least 6 characters')

    setSubmitting(true)
    try {
      const emailRedirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/`
          : undefined

      const { data, error: signupError } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          emailRedirectTo,
          data: {
            username: un,
            display_name: dn,
            home_city: selectedCity || null,
          },
        },
      })

      if (signupError) {
        setError(friendlyAuthError(signupError.message))
        setSubmitting(false)
        return
      }
      if (!data.user) {
        setError('Signup failed — no user returned')
        setSubmitting(false)
        return
      }

      // Email-confirm flow: no session yet. Show the check-your-email
      // card; the auth callback will mark onboarding complete once the
      // user lands back via the magic link.
      if (!data.session) {
        setAwaitingConfirmation(true)
        setSubmitting(false)
        return
      }

      // Active session → persist preferences and head home.
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          home_city: selectedCity || null,
          favorite_cities: selectedCity ? [selectedCity] : [],
        })
        .eq('id', data.user.id)

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === stepIndex ? 28 : 8,
              height: 6,
              backgroundColor:
                i <= stepIndex ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          />
        ))}
      </div>

      <div
        className="rounded-sm shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div key={step} className="p-6 sm:p-10 transition-opacity duration-300">
          {step === 'problem' && <ProblemStep />}
          {step === 'solution' && <SolutionStep />}
          {step === 'city' && (
            <CityStep
              cities={cities}
              selected={selectedCity}
              onSelect={(c) => setSelectedCity(c)}
            />
          )}
          {step === 'account' &&
            (authChecked && user ? (
              <AuthedReadyStep
                displayName={user.user_metadata?.display_name ?? null}
                city={selectedCity}
              />
            ) : awaitingConfirmation ? (
              <ConfirmEmailStep email={email} />
            ) : (
              <SignUpStep
                email={email}
                password={password}
                displayName={displayName}
                username={username}
                showPassword={showPassword}
                setEmail={setEmail}
                setPassword={setPassword}
                setDisplayName={setDisplayName}
                setUsername={setUsername}
                setShowPassword={setShowPassword}
                onSubmit={handleSignUp}
                submitting={submitting}
                selectedCity={selectedCity}
              />
            ))}
        </div>

        {error && (
          <div
            className="mx-6 sm:mx-10 mb-4 p-3 rounded-sm border text-sm"
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

        {/* Footer bar — hidden on pane 4 when we're mid-signup or
            awaiting email confirmation, since the primary action lives
            inside the form / confirmation card itself. */}
        {!(step === 'account' && !user && !awaitingConfirmation) &&
          !awaitingConfirmation && (
            <div
              className="px-6 sm:px-10 py-4 flex items-center justify-between gap-3"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <button
                type="button"
                onClick={goBack}
                disabled={stepIndex === 0 || submitting}
                className="inline-flex items-center gap-1 text-xs uppercase transition-opacity disabled:opacity-0"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.12em',
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div
                className="text-xs"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Step {stepIndex + 1} of {STEPS.length}
              </div>

              {step === 'account' && user ? (
                <button
                  type="button"
                  onClick={finishForAuthedUser}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.14em',
                    fontWeight: 500,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      Start exploring <ArrowRight size={14} />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceed}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.14em',
                    fontWeight: 500,
                  }}
                >
                  Continue <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
      </div>

      {/* Sign-in escape hatch — only visible on pane 4's sign-up form,
          so returning users don't have to walk through the pitch again. */}
      {step === 'account' && !user && !awaitingConfirmation && (
        <p
          className="text-center text-xs mt-4"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Already have an account?{' '}
          <a
            href="/auth/login"
            style={{
              color: 'var(--color-primary)',
              fontWeight: 500,
              textDecoration: 'underline',
            }}
          >
            Sign in
          </a>
        </p>
      )}
    </div>
  )
}

/* ---------- Step components ---------- */

function ProblemStep() {
  const sources = [
    { label: 'Google', color: '#4285F4' },
    { label: 'Yelp', color: '#D32323' },
    { label: 'Michelin', color: '#C9302C' },
    { label: 'Infatuation', color: '#0A2540' },
    { label: 'TikTok', color: '#000000' },
    { label: 'Instagram', color: '#C13584' },
    { label: 'James Beard', color: '#C9A227' },
    { label: 'Eater', color: '#D13838' },
  ]
  return (
    <div className="text-center">
      <p
        className="text-[10px] uppercase mb-3"
        style={{
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.16em',
          fontWeight: 600,
        }}
      >
        The problem
      </p>
      <h1
        className="text-2xl sm:text-3xl max-w-xl mx-auto"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
        }}
      >
        Food reviews are scattered across a dozen places.
      </h1>
      <p
        className="text-sm sm:text-base mt-4 max-w-md mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
          lineHeight: 1.6,
        }}
      >
        Google says it&rsquo;s a 4.3. Yelp says 3.8. Your TikTok feed has five
        hot takes. The Infatuation wrote a paragraph. You just want to know —
        is this place actually good?
      </p>

      <div className="mt-8 flex flex-wrap gap-2 justify-center">
        {sources.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm"
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function SolutionStep() {
  const features = [
    {
      icon: Layers,
      title: 'Every rating, side-by-side',
      desc: 'Google, Yelp, Michelin, The Infatuation, and more — on one card.',
    },
    {
      icon: Star,
      title: 'Critic-backed accolades',
      desc: 'Michelin stars, James Beard winners, the Eater 38 — surfaced automatically.',
    },
    {
      icon: Sparkles,
      title: 'Trending from TikTok & Instagram',
      desc: 'See which dishes food creators are actually raving about, not just advertising.',
    },
    {
      icon: Search,
      title: 'One search, every source',
      desc: 'Find a restaurant once, get the full picture — with sentiment-scored signature dishes.',
    },
  ]
  return (
    <div>
      <div className="text-center">
        <p
          className="text-[10px] uppercase mb-3"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.16em',
            fontWeight: 600,
          }}
        >
          The solution
        </p>
        <h2
          className="text-2xl sm:text-3xl max-w-xl mx-auto"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          Gastronome — every food rating in one place.
        </h2>
        <p
          className="text-sm sm:text-base mt-4 max-w-md mx-auto"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            lineHeight: 1.6,
          }}
        >
          We pull together critic reviews, crowd ratings, and social buzz so
          you can decide where to eat in one glance instead of six tabs.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 p-3.5 rounded-sm"
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="w-9 h-9 flex-shrink-0 rounded-sm text-white flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Icon size={16} />
            </div>
            <div>
              <p
                className="text-sm"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {title}
              </p>
              <p
                className="text-xs leading-relaxed mt-0.5"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 300,
                }}
              >
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CityStep({
  cities,
  selected,
  onSelect,
}: {
  cities: City[]
  selected: string
  onSelect: (name: string) => void
}) {
  return (
    <div>
      <div className="text-center">
        <p
          className="text-[10px] uppercase mb-3"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.16em',
            fontWeight: 600,
          }}
        >
          Step 3 — personalize
        </p>
        <h2
          className="text-2xl sm:text-3xl"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
          }}
        >
          Pick your city
        </h2>
        <p
          className="text-sm mt-2 max-w-md mx-auto"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
          }}
        >
          Choose the one city you want to explore. You can change it later in
          settings.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {cities.map((city) => {
          const on = selected === city.name
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => onSelect(on ? '' : city.name)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs uppercase transition-all"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
                backgroundColor: on
                  ? 'var(--color-primary)'
                  : 'var(--color-surface)',
                color: on ? '#fff' : 'var(--color-text)',
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: 'pointer',
              }}
            >
              {on && <Check size={13} />}
              {city.name}
            </button>
          )
        })}
      </div>

      {selected && (
        <div
          className="mt-6 p-4 rounded-sm text-center"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p
            className="inline-flex items-center gap-2 text-sm"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <MapPin size={14} style={{ color: 'var(--color-primary)' }} />
            <span>
              Exploring{' '}
              <span style={{ fontWeight: 500 }}>{selected}</span>
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function SignUpStep({
  email,
  password,
  displayName,
  username,
  showPassword,
  setEmail,
  setPassword,
  setDisplayName,
  setUsername,
  setShowPassword,
  onSubmit,
  submitting,
  selectedCity,
}: {
  email: string
  password: string
  displayName: string
  username: string
  showPassword: boolean
  setEmail: (v: string) => void
  setPassword: (v: string) => void
  setDisplayName: (v: string) => void
  setUsername: (v: string) => void
  setShowPassword: (v: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  selectedCity: string
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <p
          className="text-[10px] uppercase mb-3"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.16em',
            fontWeight: 600,
          }}
        >
          Step 4 — create account
        </p>
        <h2
          className="text-2xl sm:text-3xl"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
          }}
        >
          Join Gastronome
        </h2>
        <p
          className="text-sm mt-2 max-w-md mx-auto"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
          }}
        >
          {selectedCity
            ? `Save your ${selectedCity} picks, keep collections, and unlock the full experience.`
            : 'Save restaurants, build collections, and unlock the full experience.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Display name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={50}
            placeholder="Jamie Appleton"
            style={inputStyle}
            className="w-full px-4 py-2.5 outline-none"
            autoComplete="name"
          />
        </Field>

        <Field label="Username">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            maxLength={30}
            placeholder="jamie_appleton"
            style={inputStyle}
            className="w-full px-4 py-2.5 outline-none"
            autoComplete="username"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={inputStyle}
            className="w-full px-4 py-2.5 outline-none"
            autoComplete="email"
          />
        </Field>

        <Field label="Password">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              style={inputStyle}
              className="w-full px-4 py-2.5 outline-none pr-12"
              autoComplete="new-password"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
          }}
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight size={14} />
            </>
          )}
        </button>
      </form>

      <p
        className="text-center text-xs mt-5"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        By signing up you agree to our Terms and Privacy Policy.
      </p>
    </div>
  )
}

function AuthedReadyStep({
  displayName,
  city,
}: {
  displayName: string | null
  city: string
}) {
  return (
    <div className="text-center py-4">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-sm mb-5 shadow-lg"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <Check className="text-white" size={30} />
      </div>
      <h2
        className="text-2xl sm:text-3xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
        }}
      >
        {displayName ? `You're all set, ${displayName.split(' ')[0]}` : "You're all set"}
      </h2>
      <p
        className="text-sm mt-2 max-w-md mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
        }}
      >
        {city
          ? `We'll tune your feed to ${city}. You can always change it later in settings.`
          : 'Your feed is ready. You can set a home city later in settings.'}
      </p>
    </div>
  )
}

function ConfirmEmailStep({ email }: { email: string }) {
  return (
    <div className="text-center py-4">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-sm mb-5 shadow-lg"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <Check className="text-white" size={30} />
      </div>
      <h2
        className="text-2xl sm:text-3xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
        }}
      >
        Check your email
      </h2>
      <p
        className="text-sm mt-2 max-w-md mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
        }}
      >
        We sent a confirmation link to{' '}
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{email}</span>.
        Click the link to activate your account, then come right back.
      </p>
    </div>
  )
}

/* ---------- small helpers ---------- */

function slugifyUsername(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
}

function friendlyAuthError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('user already registered'))
    return 'An account with that email already exists. Try signing in instead.'
  if (lower.includes('weak password'))
    return 'That password is too weak — try something longer.'
  if (lower.includes('invalid email')) return 'That email looks invalid.'
  if (lower.includes('rate') || lower.includes('too many'))
    return 'Too many attempts. Please wait a minute and try again.'
  return msg
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
