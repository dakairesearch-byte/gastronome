import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Supabase = SupabaseClient<Database>

/**
 * Server-side admin authorization.
 *
 * Today there is no `is_admin` column in `profiles` and no dedicated
 * role table, so admin status is gated via an `ADMIN_USER_IDS` env var
 * (comma-separated Supabase auth UUIDs) that is read only on the server.
 * This is a stopgap — when the `profiles.is_admin` column lands, swap
 * the implementation to a DB check and keep the call-site contract.
 *
 * Callers get back `null` for "not admin / not logged in" so they can
 * respond with the appropriate 401/404/etc.
 */
export async function requireAdminUser(
  supabase: Supabase
): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const raw = process.env.ADMIN_USER_IDS ?? ''
  const allowlist = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  if (allowlist.size === 0) return null
  if (!allowlist.has(user.id)) return null

  return { id: user.id }
}
