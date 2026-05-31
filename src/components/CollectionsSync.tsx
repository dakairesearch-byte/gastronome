'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { initCollectionsSync, teardownCollectionsSync } from '@/lib/collections'

/**
 * Mount-once bridge that keeps the localStorage bookmark/collection
 * cache in sync with the signed-in user's server-side rows. Renders
 * nothing. Mounted in the root layout so a single auth listener drives
 * sync for the whole app (individual BookmarkButtons no longer need to
 * each manage server sync).
 *
 * On sign-in: pulls server state into the cache (or migrates local data
 * up on first sign-in). On sign-out: clears the local cache so saves
 * don't leak across users on a shared device. All of this degrades to a
 * no-op if the user_* tables don't exist yet (migration not applied).
 */
export default function CollectionsSync() {
  useEffect(() => {
    const supabase = createClient()
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const user = data.session?.user
      if (user) void initCollectionsSync(supabase, user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user) void initCollectionsSync(supabase, session.user.id)
      else teardownCollectionsSync()
    })

    return () => {
      active = false
      try {
        listener?.subscription?.unsubscribe?.()
      } catch {
        /* unmount path */
      }
    }
  }, [])

  return null
}
