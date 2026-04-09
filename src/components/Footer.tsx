import Link from 'next/link'
import { MapPin, Mail, Heart } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-950 text-gray-400 border-t border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                G
              </div>
              <span className="font-bold text-white tracking-tight">Gastronome</span>
            </Link>
            <p className="text-sm text-gray-400">
              Discover authentic food reviews from passionate home critics. Rate restaurants, share your dining experiences, and follow fellow food enthusiasts.
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider">
              Navigation
            </h3>
            <nav className="space-y-3">
              <Link
                href="/restaurants"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Restaurants
              </Link>
              <Link
                href="/search"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Search
              </Link>
              <Link
                href="/auth/signup"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Sign Up
               </Link>
              <Link
                href="/auth/login"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Login
              </Link>
            </nav>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider">
              Features
            </h3>
            <nav className="space-y-3">
              <Link
                href="/review/new"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Write a Review
              </Link>
              <Link
                href="/restaurants"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Explore Restaurants
              </Link>
              <Link
                href="/top-rated"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Trending
              </Link>
              <Link
                href="/search"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Top Critics
              </Link>
            </nav>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider">
              Connect
            </h3>
            <div className="space-y-3">
              <Link
                href="/restaurants"
                className="flex items-center gap-2 text-sm hover:text-amber-400 transition-colors"
              >
                <MapPin size={16} />
                Find restaurants near you
              </Link>
              <a
                href="mailto:hello@gastronome.local"
                className="flex items-center gap-2 text-sm hover:text-amber-400 transition-colors"
              >
                <Mail size={16} />
                Contact us
              </a>
              <div className="flex gap-3 pt-2">
                <span
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors cursor-pointer"
                  aria-label="Facebook"
                  role="img"
                >
                  <span className="text-xs text-white">f</span>
                </span>
                <span
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors cursor-pointer"
                  aria-label="Twitter"
                  role="img"
                >
                  <span className="text-xs text-white">X</span>
                </span>
                <span
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors cursor-pointer"
                  aria-label="Instagram"
                  role="img"
                >
                  <span className="text-xs text-white">ig</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400 text-center sm:text-left">
              &copy; {currentYear} Gastronome. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              Made with
              <Heart size={16} className="fill-red-500 text-red-500" />
              by food lovers
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
