import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className="pb-20 md:pb-0"
      style={{
        backgroundColor: 'var(--color-secondary)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <Image
                src="/Logo.jpg"
                alt="Gastronome"
                width={240}
                height={64}
                className="h-16 w-auto bg-white rounded-sm p-1"
              />
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Every restaurant rating in one place.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3
              className="text-xs uppercase tracking-wider mb-3"
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
              }}
            >
              Explore
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/explore"
                  className="text-sm hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Explore
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-sm hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Search
                </Link>
              </li>
              <li>
                <Link
                  href="/community"
                  className="text-sm hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Community
                </Link>
              </li>
            </ul>
          </div>

          {/* More */}
          <div>
            <h3
              className="text-xs uppercase tracking-wider mb-3"
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
              }}
            >
              More
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/cities"
                  className="text-sm hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Cities
                </Link>
              </li>
              <li>
                <Link
                  href="/recent"
                  className="text-sm hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Recent
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="pt-6 text-center text-xs"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: 'var(--font-body)',
          }}
        >
          &copy; {currentYear} Gastronome. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
