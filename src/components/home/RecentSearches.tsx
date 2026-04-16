'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

interface RecentSearch {
  query: string
  time: string // ISO
}

const STORAGE_KEY = 'gastronome_recent_searches'
const MAX_SEARCHES = 5

function loadSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveSearches(searches: RecentSearch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches.slice(0, MAX_SEARCHES)))
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

export default function RecentSearches() {
  const router = useRouter()
  const [searches, setSearches] = useState<RecentSearch[]>([])

  useEffect(() => {
    setSearches(loadSearches())
  }, [])

  const remove = (idx: number) => {
    const next = searches.filter((_, i) => i !== idx)
    setSearches(next)
    saveSearches(next)
  }

  if (searches.length === 0) {
    return (
      <div>
        <p
          className="text-sm py-4"
          style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Sans', sans-serif" }}
        >
          Your recent searches will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {searches.slice(0, 3).map((s, i) => (
        <div
          key={`${s.query}-${i}`}
          onClick={() => router.push(`/search?q=${encodeURIComponent(s.query)}`)}
          className="p-5 cursor-pointer transition-all hover:shadow-lg border-l rounded-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderLeftColor: 'var(--color-accent)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="mb-1"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '15px',
                  fontWeight: 400,
                }}
              >
                {s.query}
              </p>
              <p
                className="text-xs uppercase tracking-wider"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: '0.08em',
                }}
              >
                {timeAgo(s.time)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                remove(i)
              }}
              className="p-1 rounded-sm hover:bg-gray-100 transition-colors"
            >
              <X size={14} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Call this from the search page to record a new search query.
 */
export function recordSearch(query: string) {
  const searches = loadSearches()
  const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase())
  const next = [{ query, time: new Date().toISOString() }, ...filtered].slice(0, MAX_SEARCHES)
  saveSearches(next)
}
