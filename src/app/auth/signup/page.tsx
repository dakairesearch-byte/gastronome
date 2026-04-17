'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SignInModal from '@/components/auth/SignInModal'

export default function SignupPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <SignInModal
        open={open}
        onClose={() => {
          setOpen(false)
          router.push('/')
        }}
        initialMode="signup"
      />
    </div>
  )
}
