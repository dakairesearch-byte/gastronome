'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  initialValue?: string
}

export default function SearchBar({
  placeholder = 'Search restaurants, dishes, cuisines...',
  onSearch,
  initialValue = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      if (onSearch) {
        onSearch(query)
      } else {
        router.push(`/search?q=${encodeURIComponent(query)}`)
      }
    }
  }

  const handleClear = () => {
    setQuery('')
    onSearch?.('')
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" role="search">
      <div className="relative">
        {/* Leading magnifying-glass icon — was missing entirely, leaving
            the input with no affordance that it was a search field.
            Sweep v2 search P0/QW. */}
        <Search
          size={18}
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="search"
          // inputMode + enterKeyHint give mobile keyboards the right
          // primary action ("search" instead of "go"/"return") and the
          // right glyph set. Sweep v2 search QW.
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onSearch?.(e.target.value)
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full pl-10 pr-20 py-3 text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Submit search"
            className="px-3 py-1.5 text-xs uppercase tracking-wider font-medium text-white rounded-md transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Go
          </button>
        </div>
      </div>
    </form>
  )
}
