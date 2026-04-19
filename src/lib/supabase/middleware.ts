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

  // Refresh auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // Authed-but-unfinished users → forced to complete onboarding.
  if (user && !exempt) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single()

    if (profile && profile.onboarding_completed === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
