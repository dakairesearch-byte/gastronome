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
