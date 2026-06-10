import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

/**
 * Paths that are part of the auth/onboarding flow itself and must never
 * trigger the onboarding redirect (to avoid infinite loops).
 *
 * Public-read decision (Gate 1): anonymous visitors may browse all read
 * routes without an account. Write actions (bookmark, review, verdict,
 * profile edit) are gated at the component level via openSignInModal().
 * This list is now used only to prevent redirect loops — not to
 * enumerate the full set of "safe" routes.
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

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)
    }),
  ]).finally(() => {
    // Clear the timer once the race settles so it doesn't keep the
    // serverless instance alive for the full timeout after getUser resolves.
    if (timeoutId) clearTimeout(timeoutId)
  })

  const pathname = request.nextUrl.pathname
  const exempt = isExempt(pathname)

  // [Gate 1 — public-read] Anonymous visitors may browse freely.
  // Write-gating is enforced at the component level (openSignInModal).
  // The anonymous-wall redirect that lived here has been removed. See:
  //   reports/stage0/gate1-anonymous-wall/plan.md
  //
  // To restore the wall during a rollback, re-add:
  //
  //   if (!user && !exempt) {
  //     const url = request.nextUrl.clone()
  //     url.pathname = '/onboarding'
  //     url.search = ''
  //     return NextResponse.redirect(url)
  //   }
  //
  // Or set ANONYMOUS_WALL=true in the environment and use the env-flag
  // variant instead (rollback without editing logic):
  //
  //   if (process.env.ANONYMOUS_WALL === 'true' && !user && !exempt) {
  //     ...same block...
  //   }

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
      // Preserve the originally-requested URL as ?next= so that after
      // onboarding completion, the user lands on the page they intended
      // to reach (fixes UIUX catalog item onboarding-02). Encode the
      // full pathname+search to survive any special characters.
      const next = request.nextUrl.pathname + request.nextUrl.search
      url.search = next && next !== '/onboarding'
        ? '?next=' + encodeURIComponent(next)
        : ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
