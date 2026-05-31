import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
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
     *   (svg/png/jpg/jpeg/gif/webp/avif/ico)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
