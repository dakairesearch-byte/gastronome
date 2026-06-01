import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'

  // Prevent open redirect — only allow relative paths
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // The session is now established. Before honoring `next`, make sure
      // the user has actually completed onboarding — otherwise a confirmed
      // email link (or password-recovery link) would drop them onto a gated
      // page that the proxy immediately bounces back to /onboarding, losing
      // any city preference they picked at signup.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed, home_city')
          .eq('id', user.id)
          .maybeSingle()

        // Persist the home city the user chose at signup (stored in user
        // metadata) if their profile row doesn't already carry one. This
        // survives the email-confirmation round-trip, where the client-side
        // signup never got a session to write the profile directly.
        const metaHomeCity =
          (user.user_metadata?.home_city as string | null | undefined) ?? null
        if (profile && !profile.home_city && metaHomeCity) {
          await supabase
            .from('profiles')
            .update({ home_city: metaHomeCity })
            .eq('id', user.id)
        }

        // Unfinished onboarding (or missing profile row) → send to the
        // onboarding flow rather than `next`, so confirmed users finish
        // setup instead of bouncing through the proxy gate.
        if (!profile || profile.onboarding_completed === false) {
          const onboardingUrl = request.nextUrl.clone()
          onboardingUrl.pathname = '/onboarding'
          onboardingUrl.search = ''
          return NextResponse.redirect(onboardingUrl)
        }
      }

      const url = request.nextUrl.clone()
      url.pathname = next
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // return the user to the login page with an error indicator
  const url = request.nextUrl.clone()
  url.pathname = '/auth/login'
  url.searchParams.set('error', 'auth_failed')
  return NextResponse.redirect(url)
}
