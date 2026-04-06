import Link from 'next/link'
import { Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-8">
        {/* 404 Display */}
        <div className="space-y-4">
          <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
            404
          </h1>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Page Not Found
          </h2>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <p className="text-lg text-gray-600">
            We searched everywhere, but this restaurant doesn't seem to exist on Gastronome.
          </p>
          <p className="text-sm text-gray-500">
            The page you're looking for might have been moved or deleted.
          </p>
        </div>

        {/* Illustration */}
        <div className="bg-white rounded-xl p-8 border border-emerald-100 shadow-sm">
          <div className="flex justify-center mb-4">
            <Search size={48} className="text-emerald-500 opacity-50" />
          </div>
          <p className="text-gray-600 text-sm">
            Oops! Let's find something delicious instead.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href="/"
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-semibold text-center"
          >
            Go Home
          </Link>
          <Link
            href="/restaurants"
            className="px-6 py-3 border-2 border-emerald-500 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors font-semibold text-center"
          >
            Explore Restaurants
          </Link>
        </div>

        {/* Additional Links */}
        <div className="pt-8 border-t border-gray-200 space-y-4">
          <p className="text-sm text-gray-600 font-semibold">Quick Links</p>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/search" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors">
              Search
            </Link>
            <Link href="/restaurants" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors">
              Restaurants
            </Link>
            <Link href="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors">
              Login
            </Link>
            <Link href="/auth/signup" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
