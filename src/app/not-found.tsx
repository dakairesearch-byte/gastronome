import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-6">
        <h1 className="text-6xl font-bold text-emerald-500">404</h1>
        <h2 className="text-xl font-bold text-gray-900">Page not found</h2>
        <p className="text-sm text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/"
            className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
          >
            Go Home
          </Link>
          <Link
            href="/explore"
            className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Explore
          </Link>
        </div>
      </div>
    </div>
  )
}
