'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

interface HeroSearchBarProps {
  variant?: 'dark' | 'light'
}

export default function HeroSearchBar({ variant = 'dark' }: HeroSearchBarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const inputClasses =
    variant === 'dark'
      ? 'w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white/15 transition-colors'
      : 'w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm'

  const iconColor = variant === 'dark' ? 'text-gray-400' : 'text-gray-400'

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl mx-auto">
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconColor}`} size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, cuisines, neighborhoods..."
          className={inputClasses}
          aria-label="Search restaurants"
        />
      </div>
    </form>
  )
}
