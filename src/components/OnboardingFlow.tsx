'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
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
import OnboardingRestaurantPreview from './OnboardingRestaurantPreview'
import BackfillGrid from './onboarding/BackfillGrid'
import type { City, Restaurant } from '@/types/database'
import type { User } from '@supabase/supabase-js'

/**
 * Gastronome's default landing experience.
 *
 * Five panes, surfaced to EVERY visitor without an account:
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
 *   5. Backfill   — optional "Been anywhere here?" grid seeding initial
 *                   Been verdicts from the city's top restaurants.
 *                   Fully skippable; only reached with an active session
 *                   (not shown during email-confirm flow). On completion
 *                   or skip, the user lands at `?next=` or `/`.
 *
 * Authed-but-unfinished users skip straight to pane 3, finalize the
 * city, and land on the "ready to explore" confirmation instead of a
 * sign-up form (pane 4 branches on session state).
 */

type StepKey = 'problem' | 'solution' | 'city' | 'account' | 'backfill'
const STEPS: StepKey[] = ['problem', 'solution', 'city', 'account', 'backfill']
const STEP_LABELS: Record<StepKey, string> = {
  problem: 'Problem',
  solution: 'Solution',
  city: 'City',
  account: 'Sign up',
  backfill: 'Visits',
}

export default function OnboardingFlow() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [stepIndex, setStepIndex] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [cities, setCities] = useState<City[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('')

  // Live proof-of-value: a couple of real, top-rated restaurants (with
  // the Gastronome Score) shown on the Solution pane BEFORE the sign-up
  // wall. Keyed by the city we fetched for so we don't refetch on every
  // render or step change.
  const [previews, setPreviews] = useState<Restaurant[]>([])
  const [previewCity, setPreviewCity] = useState<string>('')

  // Sign-up form state (pane 4, anon users)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendNote, setResendNote] = useState('')

  const step = STEPS[stepIndex]

  // Tick the resend cooldown down once a second so the button re-enables.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendCooldown])

  /** Resend the signup confirmation email, with a 30s cooldown. */
  const handleResend = async () => {
    if (resendCooldown > 0 || submitting) return
    setError(null)
    setResendNote('')
    setSubmitting(true)
    try {
      const emailRedirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/`
          : undefined
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo },
      })
      if (resendError) {
        setError(friendlyAuthError(resendError.message))
        return
      }
      setResendNote('Sent — check your inbox (and spam) again.')
      setResendCooldown(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email.')
    } finally {
      setSubmitting(false)
    }
  }

  /** Drop back to the signup form so the user can fix a mistyped address. */
  const handleUseDifferentEmail = () => {
    setAwaitingConfirmation(false)
    setResendNote('')
    setResendCooldown(0)
    setError(null)
  }

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

  // Fetch a couple of real top restaurants to preview on the Solution
  // pane. Targets the user's selected city; otherwise falls back to the
  // most-populated active city (cities are loaded rating-desc-ordered),
  // and finally to whatever's top-rated globally. We only refetch when
  // the target city actually changes — `previewCity` guards re-runs.
  useEffect(() => {
    const targetCity = selectedCity || cities[0]?.name || ''
    if (targetCity === previewCity) return

    let active = true
    ;(async () => {
      // Pull every field SourceRatingsBar / AccoladesBadges / the
      // Gastronome Score reader need, gated to rows with a usable photo
      // so the preview never renders an empty image frame. Apply the
      // city filter inline (a `.eq` on '' is a no-op) so we never
      // reassign the builder — reassignment widens its inferred type and
      // breaks the row typing.
      const { data } = await supabase
        .from('restaurants')
        .select(
          'id, name, cuisine, city, neighborhood, photo_url, google_photo_url, photo_urls, google_rating, google_review_count, google_url, yelp_rating, yelp_review_count, yelp_url, infatuation_rating, infatuation_url, beli_score, beli_url, michelin_stars, michelin_designation, michelin_url, james_beard_winner, eater_38, social_score'
        )
        .eq('city', targetCity || '')
        .or('photo_url.not.is.null,google_photo_url.not.is.null')
        .not('google_rating', 'is', null)
        .order('google_rating', { ascending: false, nullsFirst: false })
        .limit(2)
      if (!active) return
      setPreviews((data ?? []) as Restaurant[])
      setPreviewCity(targetCity)
    })()
    return () => {
      active = false
    }
  }, [supabase, selectedCity, cities, previewCity])

  // City step used to be a hard block — Continue stayed disabled until
  // a city was selected, so users in unsupported cities (or who just
  // wanted to look first) were stuck. Now `canProceed` is always true
  // on the city step; an unselected city just defers home-city setup.
  // Sweep v2 onboarding P0.
  // Every step is now advanceable (the city step no longer hard-blocks).
  const canProceed = true

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
  useEffect(() => {
    displayNameRef.current = displayName
  })
  useEffect(() => {
    if (!displayName) return
    const auto = slugifyUsername(displayName)
    setUsername((prev) => {
      const prevAuto = slugifyUsername(displayNameRef.current)
      if (!prev || prev === prevAuto) return auto
      return prev
    })
  }, [displayName])

  /**
   * Navigate to the final destination after onboarding (and optional backfill)
   * completes. Honors a ?next= param so users who were redirected to onboarding
   * mid-journey land on their originally-requested page.
   */
  const finishFlow = () => {
    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null
    // Same-origin paths only — reject protocol-relative '//host' values so
    // ?next= can't be abused as an open redirect.
    router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
    router.refresh()
  }

  /**
   * Save preferences for an already-authed user, then advance to the backfill
   * step. Called by pane 4's "Start exploring" button when we have a session.
   */
  const finishForAuthedUser = async () => {
    if (!user) return
    setError(null)
    setSubmitting(true)
    try {
      // UPSERT (not UPDATE): a brand-new user's `profiles` row may not
      // exist yet if the DB trigger hasn't fired. A bare `.update()`
      // would no-op against a missing row, leaving onboarding_completed
      // false forever and trapping the user in the gate. Supply the
      // NOT-NULL columns from the auth user's metadata so the insert path
      // satisfies the schema.
      const meta = user.user_metadata ?? {}
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? '',
            username: (meta.username as string) ?? user.id,
            display_name:
              (meta.display_name as string) || (meta.username as string) || 'Guest',
            onboarding_completed: true,
            home_city: selectedCity || null,
            favorite_cities: selectedCity ? [selectedCity] : [],
          },
          { onConflict: 'id' }
        )
      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }
      // Advance to the optional backfill step instead of jumping straight home.
      setStepIndex(STEPS.indexOf('backfill'))
      setSubmitting(false)
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
  /**
   * Google OAuth sign-up from the onboarding funnel. Mirrors SignInModal's
   * handler so the onboarding wall offers parity with the modal. On success
   * the browser redirects to Google, then back through /auth/callback. If the
   * Google provider isn't enabled in Supabase yet, we surface a friendly note
   * rather than a raw "provider is not enabled" error.
   */
  const handleGoogle = async () => {
    setError(null)
    setOauthLoading(true)
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/`
          : undefined
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (oauthError) {
        const lower = oauthError.message.toLowerCase()
        setError(
          lower.includes('provider') || lower.includes('not enabled')
            ? 'Google sign-in isn’t enabled yet. Use email and password for now.'
            : 'Could not start Google sign-in. Please try again.'
        )
        setOauthLoading(false)
      }
      // On success the browser redirects to Google — no further state update.
    } catch {
      setError('Could not start Google sign-in. Please try again.')
      setOauthLoading(false)
    }
  }

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
    if (password !== confirmPassword) return setError('Passwords don’t match')

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

      // Active session → persist preferences and head home. If the
      // update fails we keep the user on the onboarding page rather
      // than landing them on `/` where the middleware would bounce
      // them right back.
      // UPSERT so the profile row is guaranteed to exist even if the DB
      // trigger hasn't created it yet — otherwise onboarding_completed
      // never sticks and the proxy loops the user back to /onboarding.
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: em,
            username: un,
            display_name: dn,
            onboarding_completed: true,
            home_city: selectedCity || null,
            favorite_cities: selectedCity ? [selectedCity] : [],
          },
          { onConflict: 'id' }
        )

      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }

      // Advance to the optional backfill step instead of jumping straight home.
      setStepIndex(STEPS.indexOf('backfill'))
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Image
          src="/Logo.jpg"
          alt="Gastronome"
          width={64}
          height={64}
          priority
          className="h-16 w-16 object-contain"
        />
      </div>

      {/* Progress — given role + label so AT users know what the dots
          mean. Each dot carries a step name as a visually-hidden text
          so the position becomes meaningful ("step 1 of 4: Problem")
          rather than an unlabeled bar. Sweep v2 onboarding QW. */}
      <ol
        className="flex items-center justify-center gap-2 mb-6"
        role="list"
        aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
      >
        {STEPS.map((stepName, i) => (
          <li key={stepName}>
            <span
              className="block rounded-full transition-all"
              style={{
                width: i === stepIndex ? 28 : 8,
                height: 6,
                backgroundColor:
                  i <= stepIndex ? 'var(--color-primary)' : 'var(--color-border)',
              }}
              aria-current={i === stepIndex ? 'step' : undefined}
            />
            <span className="sr-only">
              Step {i + 1} of {STEPS.length}: {STEP_LABELS[stepName]}
            </span>
          </li>
        ))}
      </ol>

      <div
        className="rounded-sm shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div key={step} className="p-6 sm:p-10 transition-opacity duration-300">
          {step === 'problem' && <ProblemStep />}
          {step === 'solution' && (
            <SolutionStep previews={previews} previewCity={previewCity} />
          )}
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
              <ConfirmEmailStep
                email={email}
                onResend={handleResend}
                onUseDifferentEmail={handleUseDifferentEmail}
                resendCooldown={resendCooldown}
                resendNote={resendNote}
                submitting={submitting}
              />
            ) : (
              <SignUpStep
                email={email}
                password={password}
                confirmPassword={confirmPassword}
                displayName={displayName}
                username={username}
                showPassword={showPassword}
                setEmail={setEmail}
                setPassword={setPassword}
                setConfirmPassword={setConfirmPassword}
                setDisplayName={setDisplayName}
                setUsername={setUsername}
                setShowPassword={setShowPassword}
                onSubmit={handleSignUp}
                onGoogle={handleGoogle}
                oauthLoading={oauthLoading}
                submitting={submitting}
                selectedCity={selectedCity}
              />
            ))}
          {step === 'backfill' && (
            <BackfillGrid
              city={selectedCity}
              supabase={supabase}
              onDone={finishFlow}
            />
          )}
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
            inside the form / confirmation card itself.
            Also hidden on the backfill step which has its own inline CTAs. */}
        {!(step === 'account' && !user && !awaitingConfirmation) &&
          !awaitingConfirmation &&
          step !== 'backfill' && (
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

      {/* Sign-in escape hatch — now visible on EVERY pane, not just
          pane 4's signup form. Returning users (cleared cookies,
          incognito) previously had to click through three pitch screens
          before they could log in. Sweep v2 onboarding P0.
          Hidden on the backfill step (user is already authed at that point). */}
      {!user && !awaitingConfirmation && step !== 'backfill' && (
        <p
          className="text-center text-xs mt-4"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Already have an account?{' '}
          {/* Use Next.js Link instead of a raw <a> so the navigation
              stays client-side and avoids a middleware round-trip that
              could bounce returning users back through onboarding. */}
          <Link
            href="/auth/login"
            style={{
              color: 'var(--color-primary)',
              fontWeight: 500,
              textDecoration: 'underline',
            }}
          >
            Sign in
          </Link>
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
          fontWeight: 400,
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

function SolutionStep({
  previews,
  previewCity,
}: {
  previews: Restaurant[]
  previewCity: string
}) {
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
            fontWeight: 400,
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
                  fontWeight: 400,
                }}
              >
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Live proof: real aggregated cards — Gastronome Score and all —
          rendered BEFORE the sign-up wall so a prospective user sees the
          payoff, not just a pitch. Display-only (no links out of
          onboarding). Hidden until at least one card is ready. */}
      {previews.length > 0 && (
        <div className="mt-8">
          <p
            className="text-[10px] uppercase mb-3 text-center"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.16em',
              fontWeight: 600,
            }}
          >
            {previewCity ? `A live taste of ${previewCity}` : 'See it live'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {previews.map((r) => (
              <OnboardingRestaurantPreview key={r.id} restaurant={r} />
            ))}
          </div>
        </div>
      )}
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
            fontWeight: 400,
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
              aria-pressed={on}
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

      {selected ? (
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
            <MapPin size={14} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
            <span>
              Exploring{' '}
              <span style={{ fontWeight: 500 }}>{selected}</span>
            </span>
          </p>
        </div>
      ) : (
        /* Skip-for-now affordance — sweep v2 onboarding P0. Users whose
           city isn't in the 6-city list were stuck; this lets them
           proceed and pick a city later from settings. */
        <p
          className="mt-6 text-center text-xs"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Not seeing your city? You can continue without picking — we&rsquo;ll
          show trending in New York and you can change it later in your
          profile.
        </p>
      )}
    </div>
  )
}

function SignUpStep({
  email,
  password,
  confirmPassword,
  displayName,
  username,
  showPassword,
  setEmail,
  setPassword,
  setConfirmPassword,
  setDisplayName,
  setUsername,
  setShowPassword,
  onSubmit,
  onGoogle,
  oauthLoading,
  submitting,
  selectedCity,
}: {
  email: string
  password: string
  confirmPassword: string
  displayName: string
  username: string
  showPassword: boolean
  setEmail: (v: string) => void
  setPassword: (v: string) => void
  setConfirmPassword: (v: string) => void
  setDisplayName: (v: string) => void
  setUsername: (v: string) => void
  setShowPassword: (v: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  onGoogle: () => void
  oauthLoading: boolean
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
            fontWeight: 400,
          }}
        >
          {selectedCity
            ? `Save your ${selectedCity} picks, keep collections, and unlock the full experience.`
            : 'Save restaurants, build collections, and unlock the full experience.'}
        </p>
      </div>

      {/* "Why we ask" trust framing — sits right above the form so the
          ask for an email is qualified before the user types it. Keeps
          the gate honest about scope: lists + home city only, no spam. */}
      <div
        className="mb-5 flex items-start gap-2.5 p-3 rounded-sm"
        style={{
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Check
          size={14}
          className="flex-shrink-0 mt-0.5"
          style={{ color: 'var(--color-accent)' }}
          aria-hidden="true"
        />
        <p
          className="text-xs"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.5,
          }}
        >
          We use your email only to save your lists and home city — no spam,
          no selling your data. That&rsquo;s the whole reason for an account.
        </p>
      </div>

      {/* Google OAuth — offered up front so new users can sign up in one tap.
          Hidden behind NEXT_PUBLIC_GOOGLE_AUTH until the Supabase provider is
          live — prevents the browser from navigating to a raw 400 JSON page
          (onboarding-01). Remove the env guard (or set to "1") after Step 4
          of gate5-auth-ops/RUNBOOK.md is complete. */}
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH === '1' && <button
        type="button"
        onClick={onGoogle}
        disabled={oauthLoading || submitting}
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
        <span className="text-sm font-medium">Continue with Google</span>
      </button>}

      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
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
        <span className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
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

        <Field label="Confirm password">
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Re-enter your password"
            style={inputStyle}
            className="w-full px-4 py-2.5 outline-none"
            autoComplete="new-password"
          />
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
          lineHeight: 1.5,
        }}
      >
        By signing up you agree to our{' '}
        <Link
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', fontWeight: 500 }}
          className="hover:opacity-80 transition-opacity"
        >
          Terms
        </Link>{' '}
        and{' '}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', fontWeight: 500 }}
          className="hover:opacity-80 transition-opacity"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}

/**
 * Inline Google "G" mark — no img/SVG asset dependency so the button renders
 * instantly on cold edge caches. Mirrors the one in SignInModal.
 */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M21.35 11.1h-9.17v2.96h5.3c-.23 1.48-1.65 4.34-5.3 4.34-3.19 0-5.8-2.65-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.04.77 3.74 1.44l2.54-2.46C16.92 3.98 14.76 3 12.18 3 6.98 3 2.75 7.23 2.75 12.5S6.98 22 12.18 22c7.03 0 9.35-4.93 9.35-7.43 0-.5-.06-.88-.18-1.47Z"
        fill="#4285F4"
      />
    </svg>
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
          fontWeight: 400,
        }}
      >
        {city
          ? `We'll tune your feed to ${city}. You can always change it later in settings.`
          : 'Your feed is ready. You can set a home city later in settings.'}
      </p>
    </div>
  )
}

function ConfirmEmailStep({
  email,
  onResend,
  onUseDifferentEmail,
  resendCooldown,
  resendNote,
  submitting,
}: {
  email: string
  onResend: () => void
  onUseDifferentEmail: () => void
  resendCooldown: number
  resendNote: string
  submitting: boolean
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
        Check your email
      </h2>
      <p
        className="text-sm mt-2 max-w-md mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
        }}
      >
        We sent a confirmation link to{' '}
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{email}</span>.
        Click the link to activate your account, then come right back.
      </p>

      {resendNote && (
        <p
          className="text-xs mt-4"
          role="status"
          style={{
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
          }}
        >
          {resendNote}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={onResend}
          disabled={resendCooldown > 0 || submitting}
          className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
          }}
        >
          {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
          {resendCooldown > 0
            ? `Resend confirmation email (${resendCooldown}s)`
            : 'Resend confirmation email'}
        </button>
        <button
          type="button"
          onClick={onUseDifferentEmail}
          className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <ArrowLeft size={13} />
          Use a different email
        </button>
      </div>
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
