import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

/**
 * Browser Supabase client.
 *
 * Env vars are validated at the moment the client is *used*, not at
 * construction time. That matters because Next.js prerenders client
 * components server-side during `next build`, and in local dev builds
 * where `.env.local` is absent this would otherwise fail the whole
 * build before any page rendered. Production deploys still fail fast
 * at first request — which is the behavior we actually want.
 *
 * The previous `|| 'http://localhost'` fallback let a misconfigured
 * deploy silently boot with a Supabase client pointed at localhost; all
 * auth checks then returned `{ user: null }`, failing open to the
 * unauthenticated branch. We keep that class of bug loud by throwing
 * from the proxy whenever env vars are actually missing at call time.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    return createBrowserClient<Database>(supabaseUrl, supabaseKey)
  }

  // Deferred failure: whichever method/property the caller reaches for
  // first will throw. Construction itself is free.
  const missing = () => {
    throw new Error(
      'Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.'
    )
  }
  return new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
    get: missing,
    apply: missing,
  })
}
