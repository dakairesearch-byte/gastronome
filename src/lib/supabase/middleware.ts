import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

/**
 * Paths that must never trigger an onboarding redirect.
 *
 * Anonymous visitors are required to complete the onboarding flow
 * (problem → solution → city → sign-up) before they can explore the
 * app. Only the onboarding page itself, the auth endpoints, API
 * routes, and Next.js internals are allowed to bypass the gate.
 *
 * `/auth/login` and `/auth/signup` are intentionally exempt so that
 * *returning* users can sign in without re-walking the pitch. The
 * onboarding flow itself links to `/auth/login` for that purpose.
 */
const ONBOARDING_EXEMPT_PREFIXES = [
  '/onboarding',
  '/auth',
  '/api',
  '/_next',
  '/favicon',
]

function isExempt(pathname: string): boolean {
  // Exact match OR immediate child only. A bare `startsWith(p)` would
  // incorrectly exempt routes like `/authors`, `/apiary`, or
  // `/onboardingfoo` from the onboarding gate.
  return ONBOARDING_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

// TEMPORARY — UI/UX sweep v2 2026-05-26 ONLY. Revert immediately after
// screenshots are captured. Allows ?__preview=<token> to bypass the auth
// redirect so the sweep can capture authenticated product surfaces.
const SWEEP_PREVIEW_TOKEN_V2_2026_05_26 = '0966e3b0359c1bef357259a1f7d7e5c5'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  if (
    request.nextUrl.searchParams.get('__preview') ===
    SWEEP_PREVIEW_TOKEN_V2_2026_05_26
  ) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as CookieOptions)
          )
        },
      },
    }
  )

  // Refresh auth token. Race against a 3s timeout: on a cold Vercel
  // serverless instance, function init plus the Supabase round-trip can
  // exceed the middleware invocation budget, producing 504
  // `MIDDLEWARE_INVOCATION_TIMEOUT` errors for the first user. Treating a
  // timeout as "no user" degrades to the unauthenticated path (redirect to
  // /onboarding for gated routes, render normally for exempt routes) — the
  // next warm request re-runs the check and lands the user where they
  // belong.
  const AUTH_TIMEOUT_MS = 3000
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)),
  ])

  const pathname = request.nextUrl.pathname
  const exempt = isExempt(pathname)

  // Anonymous visitors → forced to /onboarding. The flow is the app's
  // marketing page and sign-up funnel combined; there's no way to
  // browse without an account by design.
  if (!user && !exempt) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Authed-but-unfinished users → forced to complete onboarding. We use
  // `.maybeSingle()` because brand-new users may have signed up but
  // their `profiles` row hasn't been created yet (the trigger runs
  // asynchronously); treating "no row yet" the same as "onboarding not
  // completed" avoids letting users slip past the gate during that
  // window.
  if (user && !exempt) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.onboarding_completed === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
