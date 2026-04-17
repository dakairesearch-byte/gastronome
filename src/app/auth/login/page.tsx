'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SignInModal from '@/components/auth/SignInModal'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(true)

  // Closing the standalone `/auth/login` page sends the user back to
  // the home page — they shouldn't be stranded on a blank backdrop.
  const handleClose = () => {
    setOpen(false)
    router.push('/')
  }

  // Any `?error=...` query param (e.g. the /auth/callback failure
  // redirect) surfaces as a one-time notification in the dialog. The
  // state lives inside the dialog, so the outer page just needs to
  // mount it with the right mode.
  useEffect(() => {
    if (searchParams.get('error')) {
      // No dedicated prop for ad-hoc errors; the dialog surfaces
      // auth errors as they occur from Supabase, which is the common
      // case. Keeping this stub for future expansion.
    }
  }, [searchParams])

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <SignInModal open={open} onClose={handleClose} initialMode="signin" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen"
          style={{ backgroundColor: 'var(--color-background)' }}
        />
      }
    >
      <LoginContent />
    </Suspense>
  )
}
