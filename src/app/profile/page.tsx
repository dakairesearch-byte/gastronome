import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const revalidate = 0 // always dynamic — depends on auth state

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Logged-in: redirect to their profile
  if (user) {
    redirect(`/profile/${user.id}`)
  }

  // Not logged in: show sign-in form (matching Figma ProfilePage)
  return (
    <div
      style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}
      className="flex items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <div
            className="w-20 h-20 rounded-sm flex items-center justify-center text-white font-bold text-3xl shadow-lg"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            G
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-12">
          <h1
            className="text-4xl mb-3"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
            }}
          >
            Welcome back
          </h1>
          <p
            className="text-base"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
            }}
          >
            Sign in to your Gastronome account
          </p>
        </div>

        {/* Sign in / up links */}
        <div className="space-y-4">
          <Link
            href="/auth/login"
            className="block w-full py-4 text-center transition-all hover:opacity-90 rounded-sm text-white"
            style={{
              backgroundColor: 'var(--color-primary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            Sign In
          </Link>

          <p
            className="text-center text-sm"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="transition-colors"
              style={{ color: 'var(--color-primary)', fontWeight: 500 }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
