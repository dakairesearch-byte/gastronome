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
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-4 pr-12 text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          )}
          <button
            type="submit"
            className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
          >
            <Search size={20} />
          </button>
        </div>
      </div>
    </form>
  )
}
