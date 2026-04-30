'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

/**
 * Subscribe to the current Supabase auth user. Returns `null` while the
 * initial session probe is in flight and after sign-out, and an unsub
 * cleanup runs on unmount. Replaces the identical 15-line boilerplate
 * that was duplicated across Navigation, BottomNav, and BookmarkButton.
 */
export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return user
}
