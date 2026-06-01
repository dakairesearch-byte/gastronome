'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  initialValue?: string
  /**
   * When true, render a "By dish" affordance that routes the current
   * query into /search dishes mode (matching dish names rather than
   * restaurant names). Off by default so existing usages are unchanged.
   */
  showDishAffordance?: boolean
}

export default function SearchBar({
  placeholder = 'Search restaurants, dishes, cuisines...',
  onSearch,
  initialValue = '',
  showDishAffordance = false,
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

  // Route into /search dishes mode, carrying any typed query along so a
  // partial term ("birria") lands pre-scoped to dish matches. Controlled
  // inputs that hoist state via onSearch keep working — we always push.
  const handleDishSearch = () => {
    const q = query.trim()
    router.push(q ? `/search?mode=dishes&q=${encodeURIComponent(q)}` : '/search?mode=dishes')
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
            Sweep v2 search P0/QW. Tokenized off the off-brand gray. */}
        <Search
          size={18}
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--color-text-secondary)' }}
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
          className="w-full pl-10 pr-20 py-3 rounded-xl transition"
          style={{
            color: 'var(--color-text)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            fontFamily: 'var(--font-body)',
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="p-1.5 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Submit search"
            className="px-3 py-1.5 text-xs uppercase tracking-wider font-medium rounded-md transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
            }}
          >
            Go
          </button>
        </div>
      </div>
      {showDishAffordance && (
        <button
          type="button"
          onClick={handleDishSearch}
          className="mt-2 inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-secondary)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          Search by dish
        </button>
      )}
    </form>
  )
}
