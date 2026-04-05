import Link from 'next/link'
import { MapPin, Mail, Heart } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-300 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                G
              </div>
              <span className="font-semibold text-white">Gastronome</span>
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
              <a
                href="#"
                 className="block text-sm hover:text-amber-400 transition-colors"
              >
                Trending
              </a>
              <a
                href="#"
                className="block text-sm hover:text-amber-400 transition-colors"
              >
                Top Critics
              </a>
            </nav>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider">
              Connect
            </h3>
            <div className="space-y-3">
              <a
                href="#"
                className="flex items-center gap-2 text-sm hover:text-amber-400 transition-colors"
              >
                <MapPin size={16} />
                Find restaurants near you
              </a>
              <a
                href="mailto:hello@gastronome.local"
                className="flex items-center gap-2 text-sm hover:text-amber-400 transition-colors"
              >
                <Mail size={16} />
                Contact us
              </a>
              <div className="flex gap-3 pt-2">
                <a
                  href="#"
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors"
                  aria-label="Facebook"
                >
                  <span className="text-xs">f</span>
                </a>
                <a
                  href="#"
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors"
                  aria-label="Twitter"
                >
                  <span className="text-xs">ð</span>
                </a>
                <a
                  href="#"
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-amber-500 transition-colors"
                  aria-label="Instagram"
                >
                  <span className="text-xs">ð·</span>
                </a>
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
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 border-t border-neutral-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold tracking-widest text-amber-500 mb-2">
              GASTRONOME
            </h3>
            <p className="text-neutral-400 text-sm">
              Discover your next favorite restaurant, one review at a time.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Explore</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/discover" className="text-neutral-400 hover:text-amber-500 transition-colors text-sm">
                  Discover
                </Link>
              </li>
              <li>
                <Link href="/top-rated" className="text-neutral-400 hover:text-amber-500 transition-colors text-sm">
                  Top Rated
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-neutral-400 hover:text-amber-500 transition-colors text-sm">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-neutral-400 hover:text-amber-500 transition-colors text-sm">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-neutral-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-neutral-500 text-sm">
            Made with love for food lovers. © {currentYear} Gastronome.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-neutral-400 hover:text-amber-500 transition-colors">
              Twitter
            </a>
            <a href="#" className="text-neutral-400 hover:text-amber-500 transition-colors">
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
