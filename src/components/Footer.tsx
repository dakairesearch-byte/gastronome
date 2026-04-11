import Link from 'next/link'
import { Globe, MessageCircle, Camera } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-400 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                G
              </div>
              <span className="font-bold text-white text-sm">Gastronome</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Every restaurant rating in one place.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/restaurants" className="text-sm hover:text-white transition-colors">
                  Restaurants
                </Link>
              </li>
              <li>
                <Link href="/top-rated" className="text-sm hover:text-white transition-colors">
                  Top Rated
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm hover:text-white transition-colors">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* More */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">More</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/cities" className="text-sm hover:text-white transition-colors">
                  Cities
                </Link>
              </li>
              <li>
                <Link href="/feed" className="text-sm hover:text-white transition-colors">
                  Recently Updated
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Connect</h3>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="Website"
              >
                <Globe size={14} />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="Community"
              >
                <MessageCircle size={14} />
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="Photos"
              >
                <Camera size={14} />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-800 text-center text-xs text-gray-600">
          &copy; {currentYear} Gastronome. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
