import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import OnboardingFlow from '@/components/OnboardingFlow'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) {
    redirect('/')
  }

  return <OnboardingFlow />
}
