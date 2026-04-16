import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

/**
 * Server-side Supabase client.
 *
 * Env vars are validated at use time via a proxy — not at construction
 * time — so that `next build` static prerenders in environments
 * without `.env.local` don't crash the whole build. Production
 * deploys still fail loudly the first time any server component or
 * API route actually touches the client.
 *
 * The pre-existing `|| 'http://localhost'` fallback silently booted
 * a broken app where every auth check returned `{ user: null }`,
 * effectively failing open to the unauthenticated branch in prod. We
 * keep that class of bug loud by throwing from the proxy as soon as
 * the caller reaches for a method.
 */
export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const cookieStore = await cookies()

  if (supabaseUrl && supabaseKey) {
    return createServerClient<Database>(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions)
            )
          } catch {
            // `setAll` was called from a Server Component; ignore —
            // the middleware session refresh handles cookie writes.
          }
        },
      },
    })
  }

  // Deferred failure: throw as soon as the caller reaches for a
  // method/property. Build-time prerenders that merely construct the
  // client don't fail.
  const missing = () => {
    throw new Error(
      'Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.'
    )
  }
  return new Proxy({} as ReturnType<typeof createServerClient<Database>>, {
    get: missing,
    apply: missing,
  })
}
