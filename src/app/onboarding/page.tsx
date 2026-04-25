import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import OnboardingFlow from '@/components/OnboardingFlow'

export const dynamic = 'force-dynamic'

/**
 * Onboarding is the default landing experience for Gastronome.
 *
 * Three states:
 *   - Anonymous visitor → render the 4-pane flow. Pane 4 is the
 *     sign-up form. No escape hatch; anonymous browsing has been
 *     removed by product direction.
 *   - Authed + unfinished → render the same flow. Pane 4 becomes a
 *     "you're all set" confirmation that persists preferences.
 *   - Authed + finished → redirect straight home; they have no
 *     reason to see the pitch again.
 */
export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_completed) {
      redirect('/')
    }
  }

  return (
    <div
      className="flex-1 flex items-center justify-center p-4 sm:p-6 py-12"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <OnboardingFlow />
    </div>
  )
}
