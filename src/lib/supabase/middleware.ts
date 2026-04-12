import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

/**
 * Paths that must never trigger an onboarding redirect, even for users
 * with onboarding_completed = false. These are needed for the user to
 * be able to complete onboarding itself or sign in/out.
 */
const ONBOARDING_EXEMPT_PREFIXES = [
  '/onboarding',
  '/auth',
  '/api',
  '/_next',
  '/favicon',
]

function isExempt(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p)
  )
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
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

  // This refreshes a user's auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Force-onboarding guard: logged-in users who haven't completed onboarding
  // should be redirected to /onboarding for any non-exempt route.
  const pathname = request.nextUrl.pathname
  if (user && !isExempt(pathname)) {
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
