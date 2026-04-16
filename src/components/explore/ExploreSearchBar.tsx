'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function ExploreSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <div
      className="py-6 border-b"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottomColor: 'var(--color-border)',
      }}
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 lg:px-8">
        <div
          className="flex items-center gap-4 px-6 py-4 transition-all hover:shadow-xl border rounded-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Search className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cities, restaurants, cuisine..."
            className="flex-1 bg-transparent outline-none rounded-sm"
            style={{
              color: 'var(--color-text)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '15px',
            }}
          />
          <button
            type="submit"
            className="px-6 py-2.5 transition-all hover:opacity-90 tracking-wider uppercase text-xs rounded-sm"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
              letterSpacing: '0.12em',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            Search
          </button>
        </div>
      </form>
    </div>
  )
}
