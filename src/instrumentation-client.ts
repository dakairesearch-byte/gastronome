/**
 * Next.js client-side instrumentation (Next 16 convention).
 *
 * Runs in the browser after the document loads, before React hydration.
 * Initializes Sentry from NEXT_PUBLIC_SENTRY_DSN.
 *
 * Defensive by design: no-op when the DSN is unset OR @sentry/nextjs isn't
 * installed. The dynamic import is wrapped in try/catch and there are no
 * top-level @sentry type imports, so `npm run build` and tsc both pass
 * before the dependency is installed.
 */
async function initClientMonitoring() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  try {
    const moduleName = '@sentry/nextjs'
    const Sentry = await import(/* webpackIgnore: true */ moduleName)
    Sentry.init({
      dsn,
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0
      ),
    })
  } catch {
    // Package not installed or init failed — monitoring stays off, app runs.
  }
}

void initClientMonitoring()

/**
 * Capture router navigations as breadcrumbs for richer error context.
 * No-op when DSN is unset or the package isn't installed.
 */
export async function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse'
) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  try {
    const moduleName = '@sentry/nextjs'
    const Sentry = await import(/* webpackIgnore: true */ moduleName)
    const fn = (Sentry as Record<string, unknown>).captureRouterTransitionStart
    if (typeof fn === 'function') {
      ;(fn as (u: string, t: string) => void)(url, navigationType)
    }
  } catch {
    // ignore
  }
}
