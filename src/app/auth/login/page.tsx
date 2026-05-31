'use client'

import { Suspense, useState } from 'react'
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

  // Surface any `?error=...` (e.g. from the /auth/callback failure redirect)
  // as a banner inside the dialog.
  const errorParam = searchParams.get('error')
  const initialError = errorParam
    ? 'Sign-in failed. Please try again or use a different method.'
    : ''

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <SignInModal
        open={open}
        onClose={handleClose}
        initialMode="signin"
        initialError={initialError}
      />
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
