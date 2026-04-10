import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 pb-20 md:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center text-white font-bold text-xs">
              G
            </div>
            <span className="text-sm text-gray-400">
              &copy; {currentYear} Gastronome
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/restaurants" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Explore
            </Link>
            <Link href="/search" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Search
            </Link>
            <a href="mailto:hello@gastronome.local" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
