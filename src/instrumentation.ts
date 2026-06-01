/**
 * Next.js server-side instrumentation (Next 16 convention).
 *
 * `register()` runs once when a server instance boots, before it handles
 * requests. We use it to wire up lightweight error monitoring via Sentry.
 *
 * Everything here is defensive: if SENTRY_DSN is unset OR @sentry/nextjs
 * isn't installed yet, this is a no-op and the app builds/runs fine. The
 * dynamic import is wrapped in try/catch so an absent package never crashes
 * the server, and there are no top-level @sentry type imports so tsc passes
 * before the dependency is installed.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  // Only initialize on the Node.js server runtime (skip Edge to keep it simple).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    // Indirection via a variable specifier keeps the bundler/tsc from hard-
    // resolving the module at build time when it isn't installed yet.
    const moduleName = '@sentry/nextjs'
    const Sentry = await import(/* webpackIgnore: true */ moduleName)
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    })
  } catch {
    // Package not installed or init failed — monitoring stays off, app runs.
  }
}

/**
 * Forward server-side request errors to Sentry. No-op when DSN is unset or
 * the package isn't installed.
 */
export async function onRequestError(...args: unknown[]) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  try {
    const moduleName = '@sentry/nextjs'
    const Sentry = await import(/* webpackIgnore: true */ moduleName)
    if (typeof Sentry.captureRequestError === 'function') {
      // @sentry/nextjs exposes a helper with the exact onRequestError signature.
      ;(Sentry.captureRequestError as (...a: unknown[]) => void)(...args)
    } else if (typeof Sentry.captureException === 'function') {
      Sentry.captureException(args[0])
    }
  } catch {
    // ignore
  }
}
