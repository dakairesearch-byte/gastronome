import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js 16 renamed the `middleware` file convention to `proxy`. The
// function is now named `proxy` (default or named export) and the file
// lives at `src/proxy.ts`. Behavior is identical to the former
// middleware: every matched request runs `updateSession`, which refreshes
// the Supabase auth token and enforces the onboarding gate.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (build static files)
     * - _next/image   (image optimization endpoint)
     * - favicon.ico   (favicon file)
     * - any path ending in a static asset extension
     *   (svg/png/jpg/jpeg/gif/webp/avif/ico/webmanifest)
     *   — `webmanifest` is required so the PWA manifest at
     *   /manifest.webmanifest is publicly fetchable (iOS/Android read it
     *   for "Add to Home Screen"); without it the manifest 307s to
     *   /onboarding for anonymous users and install breaks.
     *
     * The trailing extension exclusion is the fix for a real bug: the
     * previous matcher caught `/Logo.jpg` and every other file in
     * /public, so for anonymous users the middleware redirected the
     * asset request to /onboarding (307 → HTML). That broke the logo
     * site-wide AND broke next/image optimization, whose server-side
     * fetch of the source `/Logo.jpg` was itself getting redirected.
     * Excluding asset extensions lets /public files serve directly and
     * skips the per-asset Supabase client instantiation entirely.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|webmanifest)$).*)',
  ],
}
