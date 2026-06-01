import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-6">
        <h1
          className="text-6xl font-bold"
          style={{
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          404
        </h1>
        <h2
          className="text-xl font-bold"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          Page not found
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/"
            className="px-5 py-2 rounded-lg transition-colors text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Go Home
          </Link>
          <Link
            href="/explore"
            className="px-5 py-2 rounded-lg border transition-colors text-sm font-medium"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Explore
          </Link>
        </div>
      </div>
    </div>
  )
}
